import boto3
import json
from PIL import Image
import numpy as np
import base64
import io

# Load the image
image_path = "2Diamonds.jpg" # Make sure this image file is in the same directory
img = Image.open(image_path).convert("RGB")

# Resize the image to 224x224. Why waste network bandwidth when the model expects this res.
img = img.resize((224, 224))

# Convert image to bytes and then to base64
img_byte_arr = io.BytesIO()
img.save(img_byte_arr, format='PNG')
encoded_image = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')

# Prepare the payload for the Lambda function
# The Lambda function expects a JSON with a key "image_base64"
payload = json.dumps({"image_base64": encoded_image})

# Create a SageMaker runtime client
client = boto3.client("sagemaker-runtime")

# Invoke the SageMaker endpoint.

# To directly test the SageMaker model as the Lambda *invokes* it:
# The Lambda converts the image to a NumPy array and sends it as "keras_tensor"
arr = np.array(img)
model_payload = json.dumps({"keras_tensor": arr.tolist()})

response = client.invoke_endpoint(
    EndpointName="playing-card-classification-endpoint",
    ContentType="application/json",
    Body=model_payload, # This payload directly mimics what the Lambda sends to SageMaker
)

# Show the results
print(json.loads(response["Body"].read()))

