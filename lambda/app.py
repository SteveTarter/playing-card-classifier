import json
import boto3
import base64
import numpy as np
from PIL import Image
import io
import os
import datetime
import concurrent.futures

# Whitelisted CORS origins
ALLOWED_ORIGINS = [
    "https://card-classifier.tarterware.com",
    "http://card-classifier.tarterware.info:3000"
]

# Append any custom origins passed via environment variable
_env_origins = os.environ.get("ALLOWED_ORIGINS")
if _env_origins:
    for _o in _env_origins.split(","):
        _o_stripped = _o.strip()
        if _o_stripped and _o_stripped not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(_o_stripped)

# Define label mapping (example: index to card name)
label_map = [
 'ace of clubs',
 'ace of diamonds',
 'ace of hearts',
 'ace of spades',
 'eight of clubs',
 'eight of diamonds',
 'eight of hearts',
 'eight of spades',
 'five of clubs',
 'five of diamonds',
 'five of hearts',
 'five of spades',
 'four of clubs',
 'four of diamonds',
 'four of hearts',
 'four of spades',
 'jack of clubs',
 'jack of diamonds',
 'jack of hearts',
 'jack of spades',
 'joker',
 'king of clubs',
 'king of diamonds',
 'king of hearts',
 'king of spades',
 'nine of clubs',
 'nine of diamonds',
 'nine of hearts',
 'nine of spades',
 'queen of clubs',
 'queen of diamonds',
 'queen of hearts',
 'queen of spades',
 'seven of clubs',
 'seven of diamonds',
 'seven of hearts',
 'seven of spades',
 'six of clubs',
 'six of diamonds',
 'six of hearts',
 'six of spades',
 'ten of clubs',
 'ten of diamonds',
 'ten of hearts',
 'ten of spades',
 'three of clubs',
 'three of diamonds',
 'three of hearts',
 'three of spades',
 'two of clubs',
 'two of diamonds',
 'two of hearts',
 'two of spades'
]

model = None

def lambda_handler(event, context):
    # Grab the Origin header (case‑insensitive)
    headers = event.get("headers") or {}
    origin = headers.get("Origin") or headers.get("origin", "")
    
    # Decide which origin to return
    acao = origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]

    # Common CORS headers
    cors_headers = {
        "Access-Control-Allow-Origin": acao,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
    }

    try:
        if event["httpMethod"] == "OPTIONS":
            return {
                "statusCode": 200,
                'headers': {
                    **cors_headers,
                    'Content-Type': 'application/json'
                },
                "body": json.dumps({"message": "CORS preflight OK"})
            }

        # Route administrative calls
        path = event.get("path", "")
        if path.endswith("/stats"):
            http_method = event.get("httpMethod", "")
            if http_method == "GET":
                query_params = event.get("queryStringParameters") or {}
                action = query_params.get("action", "stats")
                if action == "stats":
                    return handle_get_stats(cors_headers)
                elif action == "details":
                    filter_type = query_params.get("filter_type", "")
                    filter_value = query_params.get("filter_value", "")
                    return handle_get_details(filter_type, filter_value, cors_headers)

        elif path.endswith("/grading"):
            http_method = event.get("httpMethod", "")
            if http_method == "GET":
                # Other GET actions (like action=list) require auth
                if not is_admin_authorized(event):
                    return {
                        "statusCode": 403,
                        "headers": cors_headers,
                        "body": json.dumps({"error": "Unauthorized: Access restricted to superusers."})
                    }
                return handle_list_unjudged(cors_headers)
                
            elif http_method == "POST":
                if not is_admin_authorized(event):
                    return {
                        "statusCode": 403,
                        "headers": cors_headers,
                        "body": json.dumps({"error": "Unauthorized: Access restricted to superusers."})
                    }
                body = json.loads(event["body"])
                return handle_submit_grading(body, cors_headers)
            else:
                return {
                    "statusCode": 405,
                    "headers": cors_headers,
                    "body": json.dumps({"error": f"Method {http_method} not allowed."})
                }

        # Get the image payload from the request body
        body = json.loads(event["body"])
        image_data = body.get("image_base64")
        if image_data is None:
            return {
                "statusCode": 400,
                "headers": cors_headers,
                "body": json.dumps({"error": "Missing 'image_base64' in request."})
            }



        # Decode base64
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        # **Convert to RGB (drops any alpha channel)**
        image = image.convert("RGB")

        # Now resize
        image = image.resize((224, 224))

        # This array will now be shape (224, 224, 3)
        arr = np.array(image)

        # Prepare payload for SageMaker
        payload = json.dumps({"keras_tensor": arr.tolist()});

        # Invoke SageMaker endpoint
        endpoint_name = os.environ.get("SAGEMAKER_ENDPOINT_NAME", "playing-card-classification-endpoint")
        runtime = boto3.client("sagemaker-runtime")
        response = runtime.invoke_endpoint(
            EndpointName=endpoint_name,
            ContentType="application/json",
            Body=payload
        )

        result = json.loads(response["Body"].read())
        predictions = result["predictions"][0]

        # Map to label
        class_index = int(np.argmax(predictions))
        confidence = float(predictions[class_index])

        label = label_map[class_index]

        # Save image and result to S3
        s3 = boto3.client("s3")
        session_id = context.aws_request_id
        bucket_name = os.environ.get("BUCKET_NAME")
        if not bucket_name:
            raise ValueError("BUCKET_NAME environment variable not set")
        
        # Get the target prefix for S3 objects, default to "raw_data/"
        s3_target_prefix = os.environ.get("S3_TARGET_PREFIX", "raw_data/")
        # Ensure the prefix ends with a slash if it's not empty, for consistent S3 pathing
        if s3_target_prefix and not s3_target_prefix.endswith('/'):
            s3_target_prefix += '/'

        # Construct the base folder for this request ID
        request_folder = f"{s3_target_prefix}aws_request_id_{session_id}/"
        
        # Save image as PNG
        img_buffer = io.BytesIO()
        image.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        s3.put_object(
            Bucket=bucket_name,
            Key=f"{request_folder}image.png", # Updated Key
            Body=img_buffer,
            ContentType="image/png"
        )

        # Save result as JSON
        result_obj = {
            "label": label,
            "confidence": confidence
        }
        s3.put_object(
            Bucket=bucket_name,
            Key=f"{request_folder}results.json", # Updated Key
            Body=json.dumps(result_obj),
            ContentType="application/json"
        )

        return {
            "statusCode": 200,
            'headers': {
                **cors_headers,
                'Content-Type': 'application/json'
            },
            "body": json.dumps({
                "label": label,
                "confidence": confidence
            })
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "statusCode": 500,
            "headers": {
                **cors_headers,
                'Content-Type': 'application/json'
            },
            "body": json.dumps({"error": str(e)})
        }


def is_admin_authorized(event):
    if os.environ.get("BYPASS_AUTH") == "true":
        return True
    request_context = event.get("requestContext", {})
    authorizer = request_context.get("authorizer", {})
    claims = authorizer.get("claims", {})
    groups = claims.get("cognito:groups", "")
    
    if not groups:
        return False
    if "superuser" in groups:
        return True
    try:
        parsed_groups = json.loads(groups)
        if isinstance(parsed_groups, list) and "superuser" in parsed_groups:
            return True
    except:
        pass
    return False


def parse_card(label):
    label_lower = label.lower().strip()
    if " of " in label_lower:
        rank, suit = label_lower.split(" of ")
        return rank.strip(), suit.strip()
    return label_lower, "joker"


def handle_list_unjudged(cors_headers):
    s3 = boto3.client("s3")
    bucket_name = os.environ.get("BUCKET_NAME")
    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable not set")
    
    judged_keys = set()
    paginator = s3.get_paginator('list_objects_v2')
    
    try:
        for page in paginator.paginate(Bucket=bucket_name, Prefix="results/"):
            for obj in page.get('Contents', []):
                key = obj['Key']
                if key.endswith(".json"):
                    req_id = key.split("/")[-1].replace(".json", "")
                    judged_keys.add(req_id)
    except Exception as e:
        pass

    raw_items = {}
    s3_target_prefix = os.environ.get("S3_TARGET_PREFIX", "raw_data/")
    if s3_target_prefix and not s3_target_prefix.endswith('/'):
        s3_target_prefix += '/'

    try:
        for page in paginator.paginate(Bucket=bucket_name, Prefix=s3_target_prefix):
            for obj in page.get('Contents', []):
                key = obj['Key']
                parts = key.split("/")
                if len(parts) >= 2 and parts[1].startswith("aws_request_id_"):
                    req_id = parts[1]
                    if req_id not in raw_items:
                        raw_items[req_id] = {
                            "request_id": req_id,
                            "last_modified": obj['LastModified']
                        }
                    else:
                        if obj['LastModified'] > raw_items[req_id]["last_modified"]:
                            raw_items[req_id]["last_modified"] = obj['LastModified']
    except Exception as e:
        pass

    unjudged_items = []
    for req_id, item in raw_items.items():
        if req_id not in judged_keys:
            unjudged_items.append(item)
            
    unjudged_items.sort(key=lambda x: x["last_modified"], reverse=True)
    
    results = []
    def fetch_unjudged_card(item):
        req_id = item["request_id"]
        try:
            res_obj = s3.get_object(Bucket=bucket_name, Key=f"{s3_target_prefix}{req_id}/results.json")
            pred_data = json.loads(res_obj["Body"].read().decode('utf-8'))
            
            image_url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': f"{s3_target_prefix}{req_id}/image.png"},
                ExpiresIn=3600
            )
            
            return {
                "request_id": req_id,
                "predicted_label": pred_data.get("label"),
                "confidence": pred_data.get("confidence"),
                "image_url": image_url,
                "timestamp": item["last_modified"].isoformat()
            }
        except Exception as e:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_unjudged_card, item): item for item in unjudged_items}
        for future in concurrent.futures.as_completed(futures):
            res_card = future.result()
            if res_card:
                results.append(res_card)
                
    # Sort results by timestamp descending since parallel fetches complete in random order
    results.sort(key=lambda x: x["timestamp"], reverse=True)
            
    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"unjudged_cards": results})
    }


def handle_submit_grading(body, cors_headers):
    s3 = boto3.client("s3")
    bucket_name = os.environ.get("BUCKET_NAME")
    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable not set")
        
    request_id = body.get("request_id")
    actual_label = body.get("actual_label")
    
    if not request_id or not actual_label:
        return {
            "statusCode": 400,
            "headers": cors_headers,
            "body": json.dumps({"error": "Missing 'request_id' or 'actual_label' in request body."})
        }
        
    s3_target_prefix = os.environ.get("S3_TARGET_PREFIX", "raw_data/")
    if s3_target_prefix and not s3_target_prefix.endswith('/'):
        s3_target_prefix += '/'

    try:
        res_obj = s3.get_object(Bucket=bucket_name, Key=f"{s3_target_prefix}{request_id}/results.json")
        pred_data = json.loads(res_obj["Body"].read().decode('utf-8'))
    except Exception as e:
        return {
            "statusCode": 404,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Original prediction details not found for {request_id}."})
        }
        
    predicted_label = pred_data.get("label")
    confidence = pred_data.get("confidence")
    is_correct = (predicted_label == actual_label)
    
    judged_result = {
        "request_id": request_id,
        "predicted_label": predicted_label,
        "actual_label": actual_label,
        "confidence": confidence,
        "is_correct": is_correct,
        "judged_at": datetime.datetime.utcnow().isoformat() + "Z"
    }
    
    try:
        s3.put_object(
            Bucket=bucket_name,
            Key=f"results/{request_id}.json",
            Body=json.dumps(judged_result),
            ContentType="application/json"
        )
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": f"Failed to save grading: {str(e)}"})
        }
        
    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"message": "Grading saved successfully.", "is_correct": is_correct})
    }

def handle_get_details(filter_type, filter_value, cors_headers):
    s3 = boto3.client("s3")
    bucket_name = os.environ.get("BUCKET_NAME")
    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable not set")
        
    s3_target_prefix = os.environ.get("S3_TARGET_PREFIX", "raw_data/")
    if not s3_target_prefix.endswith('/'):
        s3_target_prefix += '/'

    # 1. List all json files in results/
    keys = []
    paginator = s3.get_paginator('list_objects_v2')
    try:
        for page in paginator.paginate(Bucket=bucket_name, Prefix="results/"):
            for obj in page.get('Contents', []):
                key = obj['Key']
                if key.endswith(".json"):
                    keys.append(key)
    except Exception as e:
        pass

    results_data = []
    def fetch_key(key):
        try:
            res_obj = s3.get_object(Bucket=bucket_name, Key=key)
            return json.loads(res_obj["Body"].read().decode('utf-8'))
        except Exception as e:
            return None

    # Load results in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_key, key): key for key in keys}
        for future in concurrent.futures.as_completed(futures):
            data = future.result()
            if data:
                results_data.append(data)

    # 2. Filter results
    filtered_results = []
    filter_value = filter_value.lower().strip()
    
    for r in results_data:
        actual = r.get("actual_label", "")
        
        match = False
        if filter_type == "special" and filter_value == "invalid":
            if actual == "invalid":
                match = True
        elif actual != "invalid":
            actual_rank, actual_suit = parse_card(actual)
            if filter_type == "suit":
                if actual_suit == filter_value:
                    match = True
            elif filter_type == "rank":
                if actual_rank == filter_value:
                    match = True
                
        if match:
            # Generate pre-signed URL
            req_id = r.get("request_id", "")
            image_url = ""
            if req_id:
                try:
                    image_url = s3.generate_presigned_url(
                        'get_object',
                        Params={'Bucket': bucket_name, 'Key': f"{s3_target_prefix}{req_id}/image.png"},
                        ExpiresIn=3600
                    )
                except Exception:
                    pass
            
            filtered_results.append({
                "request_id": req_id,
                "predicted_label": r.get("predicted_label"),
                "actual_label": actual,
                "confidence": r.get("confidence"),
                "is_correct": r.get("is_correct"),
                "judged_at": r.get("judged_at", r.get("timestamp")),
                "image_url": image_url
            })
            
    # Sort by judged_at or timestamp descending (newest first)
    filtered_results.sort(key=lambda x: x.get("judged_at") or "", reverse=True)
    
    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"cards": filtered_results})
    }


def handle_get_stats(cors_headers):
    s3 = boto3.client("s3")
    bucket_name = os.environ.get("BUCKET_NAME")
    if not bucket_name:
        raise ValueError("BUCKET_NAME environment variable not set")
        
    paginator = s3.get_paginator('list_objects_v2')
    keys = []
    try:
        for page in paginator.paginate(Bucket=bucket_name, Prefix="results/"):
            for obj in page.get('Contents', []):
                if obj['Key'].endswith('.json'):
                    keys.append(obj['Key'])
    except Exception as e:
        pass
        
    if not keys:
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "total_judged": 0,
                "total_correct": 0,
                "overall_accuracy": 0.0,
                "accuracy_by_suit": [],
                "accuracy_by_rank": [],
                "common_errors": [],
                "avg_correct_confidence": 0.0,
                "avg_incorrect_confidence": 0.0,
                "recent_judgments": []
            })
        }
        
    results_data = []
    def fetch_key(key):
        try:
            res_obj = s3.get_object(Bucket=bucket_name, Key=key)
            return json.loads(res_obj["Body"].read().decode('utf-8'))
        except Exception as e:
            return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(fetch_key, key): key for key in keys}
        for future in concurrent.futures.as_completed(futures):
            data = future.result()
            if data:
                results_data.append(data)
                
    if not results_data:
        return {
            "statusCode": 200,
            "headers": cors_headers,
            "body": json.dumps({
                "total_judged": 0,
                "total_correct": 0,
                "total_invalid": 0,
                "overall_accuracy": 0.0,
                "accuracy_by_suit": [],
                "accuracy_by_rank": [],
                "common_errors": [],
                "avg_correct_confidence": 0.0,
                "avg_incorrect_confidence": 0.0,
                "recent_judgments": []
            })
        }
        
    total_invalid = sum(1 for r in results_data if r.get("actual_label") == "invalid")
    valid_results = [r for r in results_data if r.get("actual_label") != "invalid"]
    
    total_judged = len(valid_results)
    total_correct = sum(1 for r in valid_results if r.get("is_correct", False))
    
    suit_stats = {}
    rank_stats = {}
    error_counts = {}
    correct_confidences = []
    incorrect_confidences = []
    
    for r in valid_results:
        pred = r.get("predicted_label", "")
        actual = r.get("actual_label", "")
        is_correct = r.get("is_correct", False)
        conf = float(r.get("confidence", 0.0))
        
        actual_rank, actual_suit = parse_card(actual)
        
        if actual_suit not in suit_stats:
            suit_stats[actual_suit] = {"correct": 0, "total": 0}
        suit_stats[actual_suit]["total"] += 1
        if is_correct:
            suit_stats[actual_suit]["correct"] += 1
            correct_confidences.append(conf)
        else:
            incorrect_confidences.append(conf)
            
        if actual_rank not in rank_stats:
            rank_stats[actual_rank] = {"correct": 0, "total": 0}
        rank_stats[actual_rank]["total"] += 1
        if is_correct:
            rank_stats[actual_rank]["correct"] += 1
            
        if not is_correct:
            err_key = (pred, actual)
            error_counts[err_key] = error_counts.get(err_key, 0) + 1
            
    suits_list = []
    for s, stats in suit_stats.items():
        suits_list.append({
            "suit": s,
            "correct": stats["correct"],
            "total": stats["total"],
            "accuracy": stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        })
        
    ranks_list = []
    for r_name, stats in rank_stats.items():
        ranks_list.append({
            "rank": r_name,
            "correct": stats["correct"],
            "total": stats["total"],
            "accuracy": stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        })
    # Sort from best accuracy to worst (secondary sort by total reviewed descending)
    ranks_list.sort(key=lambda x: (x["accuracy"], x["total"]), reverse=True)
        
    common_errors = []
    for (pred, actual), count in error_counts.items():
        common_errors.append({
            "predicted": pred,
            "actual": actual,
            "count": count
        })
    common_errors.sort(key=lambda x: x["count"], reverse=True)
    
    avg_correct_conf = sum(correct_confidences) / len(correct_confidences) if correct_confidences else 0.0
    avg_incorrect_conf = sum(incorrect_confidences) / len(incorrect_confidences) if incorrect_confidences else 0.0
    
    stats_payload = {
        "total_judged": total_judged,
        "total_correct": total_correct,
        "total_invalid": total_invalid,
        "overall_accuracy": total_correct / total_judged if total_judged > 0 else 0.0,
        "accuracy_by_suit": suits_list,
        "accuracy_by_rank": ranks_list,
        "common_errors": common_errors[:10],
        "avg_correct_confidence": avg_correct_conf,
        "avg_incorrect_confidence": avg_incorrect_conf,
        "recent_judgments": sorted(results_data, key=lambda x: x.get("judged_at", ""), reverse=True)[:10]
    }
    
    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps(stats_payload)
    }
