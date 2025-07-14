# Deploying TensorFlow Model to Amazon SageMaker

This guide explains how to package and deploy a trained TensorFlow model to Amazon SageMaker for use in an inference endpoint. This model classifies playing cards and expects unprocessed 224x224 RGB images as input.

---

## Directory Structure

The relevant files should be organized as follows:

```
model/
├── export/
├── saved_model/
│   ├── saved_model.pb
│   └── 1/
│       ├── fingerprint.pb
│       ├── saved_model.pb
│       └── variables/
│           ├── variables.data-00000-of-00001
│           └── variables.index
└── model.tar.gz        # Generated archive to upload to S3
```

---

## Prerequisites

- An AWS account with SageMaker permissions
- AWS CLI configured (`aws configure`)
- Trained TensorFlow model exported using `model.save('model/1')`
- Python and `tar` utility installed

---

## Step 1: Export the Model

The soon-to-be-included Jupyter notebook includes code to build and evaluate the TensorFlow model, as well as export it to this directory.  A model built using this notebook is in this repo.

---

## Step 2: Package the Model

Create a `.tar.gz` archive of the `model/` directory:

```bash
cd model/export
tar -cvzf model.tar.gz 1/
```

> **Important:** The archive **must** contain the version directory (`1/`) directly inside. SageMaker expects the versioned structure.

---

## Step 3: Upload the Model to S3

Create an S3 bucket if needed, then upload:

```bash
aws s3 mb s3://your-s3-bucket-name
aws s3 cp model.tar.gz s3://your-s3-bucket-name/model.tar.gz
```

---

## Step 4: Create the SageMaker Model

```bash
aws sagemaker create-model \
  --model-name playing-card-classification-model \
  --primary-container Image="763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.13-cpu-py39-ubuntu20.04",ModelDataUrl="s3://your-bucket-name/model.tar.gz" \
  --execution-role-arn arn:aws:iam::123456789012:role/service-role/AmazonSageMaker-ExecutionRole
```

Update:
- `--model-name` with a descriptive name.
- `ModelDataUrl` with your S3 path.
- `execution-role-arn` with your SageMaker execution role.

---

## Step 5: Deploy the Model to an Endpoint

```bash
aws sagemaker create-endpoint-config \
  --endpoint-config-name card-classifier-config \
  --production-variants VariantName=AllTraffic,ModelName=playing-card-classification-model,InitialInstanceCount=1,InstanceType=ml.m5.large

aws sagemaker create-endpoint \
  --endpoint-name playing-card-classification-endpoint \
  --endpoint-config-name card-classifier-config
```

Monitor endpoint creation with:

```bash
aws sagemaker describe-endpoint --endpoint-name playing-card-classification-endpoint
```

---

## Step 6: Invoke the Endpoint (Test)

Example Python test:

```python
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

# The results from the model is a vector of probabilities for each card.
print(json.loads(response["Body"].read()))
```

---

## Cleanup (Optional)

```bash
aws sagemaker delete-endpoint --endpoint-name playing-card-classification-endpoint
aws sagemaker delete-endpoint-config --endpoint-config-name card-classifier-config
aws sagemaker delete-model --model-name playing-card-classification-model
```

---

## Notes

- If your model performs its own resizing and normalization, send base64-encoded 224x224x3 RGB data.
- The container image shown uses TensorFlow 2.13 (CPU). Adjust if you're using a different version or GPU.
