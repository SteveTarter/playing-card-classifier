import json
import boto3
import base64
import numpy as np
from PIL import Image
import io

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
    try:
        if event["httpMethod"] == "OPTIONS":
            return {
                "statusCode": 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
                },
                "body": json.dumps({"message": "CORS preflight OK"})
            }

        # Get the image payload from the request body
        body = json.loads(event["body"])
        image_data = body.get("image_base64")
        if image_data is None:
            return {
                "statusCode": 400,
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
        runtime = boto3.client("sagemaker-runtime")
        response = runtime.invoke_endpoint(
            EndpointName="playing-card-classification-endpoint",
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
        session_id = context.aws_request_id
        bucket_name = "your-s3-bucket-name"  # Replace with your actual bucket name
        s3 = boto3.client("s3")

        # Save image as PNG
        img_buffer = io.BytesIO()
        image.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        s3.put_object(
            Bucket=bucket_name,
            Key=f"{session_id}.png",
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
            Key=f"{session_id}.json",
            Body=json.dumps(result_obj),
            ContentType="application/json"
        )

        return {
            "statusCode": 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            "body": json.dumps({
                "label": label,
                "confidence": confidence
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
            },
            "body": json.dumps({"error": str(e)})
        }

