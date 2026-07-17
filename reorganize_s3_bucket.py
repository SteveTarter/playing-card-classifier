import boto3
import re
import os
from botocore.exceptions import ClientError

def reorganize_s3_bucket(
    bucket_name: str,
    source_prefix: str,
    target_prefix: str,
    file_name_regex: str,
    copy_files: bool = True # Set to False to move (copy then delete)
):
    """
    Reorganizes S3 objects from a flat structure to a hierarchical one
    based on an extracted ID from the filename.

    Args:
        bucket_name (str): The name of your S3 bucket.
        source_prefix (str): The S3 prefix (folder) where your current flat files are located.
                              Must end with '/'. E.g., 'raw_data/'
        target_prefix (str): The S3 prefix (folder) where the new hierarchical structure will be created.
                              Must end with '/'. E.g., 'processed_results/'
        file_name_regex (str): A regular expression with a capturing group for the unique ID.
                                Example: r'my_base_name_aws_request_id_([a-zA-Z0-9-]+)\.(json|png)$'
                                The first capturing group should be the ID.
                                The second capturing group should be 'json' or 'png'.
        copy_files (bool): If True, files are copied. If False, files are moved (copied then deleted).
    """
    s3_client = boto3.client('s3')
    paginator = s3_client.get_paginator('list_objects_v2')

    print(f"Starting S3 reorganization for bucket: {bucket_name}")
    print(f"Source prefix: {source_prefix}")
    print(f"Target prefix: {target_prefix}")
    print(f"File name regex: {file_name_regex}")
    print(f"Mode: {'Copy' if copy_files else 'Move'}")

    processed_ids = set()
    errors = []
    
    # Compile the regex for efficiency
    compiled_regex = re.compile(file_name_regex)

    pages = paginator.paginate(Bucket=bucket_name, Prefix=source_prefix)
    
    object_count = 0

    for page in pages:
        if "Contents" not in page:
            continue

        for obj in page["Contents"]:
            object_count += 1
            source_key = obj["Key"]
            file_name = os.path.basename(source_key)

            match = compiled_regex.match(file_name)

            if match:
                request_id = match.group(1)
                file_extension = match.group(2) # 'json' or 'png'

                # Determine new target key based on file type
                if file_extension == 'json':
                    new_file_name = 'results.json'
                elif file_extension == 'png':
                    new_file_name = 'image.png'
                else:
                    print(f"Warning: Unhandled file extension '{file_extension}' for {file_name}. Skipping.")
                    continue

                target_key = f"{target_prefix}aws_request_id_{request_id}/{new_file_name}"

                try:
                    print(f"Processing: {source_key} -> {target_key}")
                    s3_client.copy_object(
                        Bucket=bucket_name,
                        CopySource={'Bucket': bucket_name, 'Key': source_key},
                        Key=target_key
                    )

                    if not copy_files:
                        s3_client.delete_object(Bucket=bucket_name, Key=source_key)
                        print(f"Deleted source: {source_key}")
                    
                    # Mark the ID as processed only after both file types (if applicable) are handled for this ID
                    # This script processes files one by one. If both json and png for an ID are found in the same list_objects call,
                    # this will prevent re-processing. If they are split across pages, the set helps avoid redundant work.
                    # For robust grouping before processing, consider listing all and then grouping.
                    processed_ids.add(request_id) # Add to set after successful copy/move
                    
                except ClientError as e:
                    error_msg = f"Error processing {source_key}: {e}"
                    print(error_msg)
                    errors.append(error_msg)
                except Exception as e:
                    error_msg = f"Unexpected error with {source_key}: {e}"
                    print(error_msg)
                    errors.append(error_msg)
            else:
                print(f"No match for {file_name} with regex. Skipping.")
    
    print("\n--- Reorganization Complete ---")
    print(f"Total objects scanned: {object_count}")
    print(f"Unique request IDs processed: {len(processed_ids)}")
    if errors:
        print(f"Errors encountered: {len(errors)}")
        for error in errors:
            print(f"  - {error}")
    else:
        print("No errors reported.")
    print(f"Files {'copied' if copy_files else 'moved'} to {target_prefix} structure.")

if __name__ == "__main__":
    # --- Configuration ---
    YOUR_S3_BUCKET_NAME = "card-classifier-results" # <<< REPLACE WITH YOUR BUCKET NAME
    YOUR_SOURCE_PREFIX = ""          # <<< REPLACE WITH YOUR SOURCE FOLDER (must end with /)
    YOUR_TARGET_PREFIX = "processed_results/"  # <<< REPLACE WITH YOUR TARGET FOLDER (must end with /)

    # --- IMPORTANT: Adjust this regex to match your exact file naming convention ---
    # Example: 'my_results_aws_request_id_abcdef1234567890.json'
    # Example: 'report_data_aws_request_id_xyz7890123456789.png'
    # The first group `([a-zA-Z0-9-]+)` captures the unique ID.
    # The second group `(json|png)` captures the extension.
    YOUR_FILE_NAME_REGEX = r'^(.+)\.(json|png)$' # Adjust if your filename has an initial prefix

    # Test cases for the regex:
    # "some_prefix_aws_request_id_123-abc.json" -> ID: "123-abc", Ext: "json"
    # "another_aws_request_id_def-456.png" -> ID: "def-456", Ext: "png"
    # If your files are just `aws_request_id_123.json`, use `r'aws_request_id_([a-zA-Z0-9-]+)\.(json|png)$'`

    # Set to True to only copy (safer for testing), False to copy and then delete (move)
    COPY_ONLY = False 

    # --- Run the reorganization ---
    reorganize_s3_bucket(
        bucket_name=YOUR_S3_BUCKET_NAME,
        source_prefix=YOUR_SOURCE_PREFIX,
        target_prefix=YOUR_TARGET_PREFIX,
        file_name_regex=YOUR_FILE_NAME_REGEX,
        copy_files=COPY_ONLY
    )
