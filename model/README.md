# Deploying TensorFlow Model to Amazon SageMaker

This guide explains how to package and deploy a trained TensorFlow model to Amazon SageMaker for use in an inference endpoint. This model classifies playing cards and expects unprocessed 224x224 RGB images as input.

---

## Directory Structure

The relevant files should be organized as follows:

```
model/
├── 1/
│   ├── saved_model.pb
│   └── variables/
│       ├── variables.data-00000-of-00001
│       └── variables.index
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

If not already done, save your model in the TensorFlow `SavedModel` format:

```python
model.save("model/1")
```

---

## Step 2: Package the Model

Create a `.tar.gz` archive of the `model/` directory:

```bash
cd model
tar -czf model.tar.gz 1/
```

> **Important:** The archive **must** contain the version directory (`1/`) directly inside. SageMaker expects the versioned structure.

---

## Step 3: Upload the Model to S3

Create an S3 bucket if needed, then upload:

```bash
aws s3 mb s3://your-bucket-name
aws s3 cp model.tar.gz s3://your-bucket-name/model.tar.gz
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
import boto3
import json
from PIL import Image
import numpy as np

img = Image.open("2Diamonds.jpg").convert("RGB")
arr = np.array(img)

payload = json.dumps({"input_layer": arr.tolist()})
client = boto3.client("sagemaker-runtime")

response = client.invoke_endpoint(
    EndpointName="playing-card-classification-endpoint",
    ContentType="application/json",
    Body=payload,
)

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

- If your model performs its own resizing and normalization, send raw 224x224x3 RGB data.
- The container image shown uses TensorFlow 2.13 (CPU). Adjust if you're using a different version or GPU.
