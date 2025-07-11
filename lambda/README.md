# Lambda Function – Playing Card Classifier

This Lambda function acts as an inference relay between a frontend API Gateway and a deployed SageMaker endpoint. It receives image data from a client, forwards it to SageMaker for classification, and returns a human-readable playing card label with a confidence score.

## File Structure

```
lambda/
├── app.py               # Main Lambda function handler
├── requirements.txt     # Python dependencies
└── README.md            # This file
```

If additional Python packages are needed, you can create a `lambda_package/` directory and install dependencies into it prior to zipping.

## Deployment Instructions

### 1. Set Environment Variables

In the AWS Lambda Console, define the following environment variable:

| Key                     | Description                                 |
|------------------------|---------------------------------------------|
| `SAGEMAKER_ENDPOINT_NAME` | The name of the deployed SageMaker endpoint |

### 2. Install Python Dependencies

From within the `lambda/` directory, run:

```bash
mkdir -p lambda_package
pip install -r requirements.txt -t lambda_package/
```

This installs required packages (e.g., `boto3`, `numpy`, `Pillow`) into a staging directory.

### 3. Create Deployment Package

```bash
cd lambda_package
zip -r ../lambda-deploy.zip .
cd ..
zip -g lambda-deploy.zip app.py
```

You now have a ready-to-upload `lambda-deploy.zip`.

### 4. Upload to Lambda

Upload the `lambda-deploy.zip` in the AWS Console or run:

```bash
aws lambda update-function-code   --function-name your-lambda-function-name   --zip-file fileb://lambda-deploy.zip
```

## Expected Input Format

Lambda expects the client to POST a JSON payload:

```json
{
  "image": [[... pixel array ...]]
}
```

The `image` field should be a raw 224x224 RGB pixel array, unnormalized.

## Sample Output

```json
{
  "label": "two of diamonds",
  "confidence": 99.99
}
```

## API Gateway and CORS

Ensure your API Gateway:

- Is configured as a REST API (not HTTP)
- Has `POST` and `OPTIONS` methods
- Has CORS enabled with the following headers:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST,OPTIONS
Access-Control-Allow-Headers: Content-Type
```

You must also return these headers from Lambda responses.

## Dependencies

List of Python packages (see `requirements.txt`):

- `boto3`
- `numpy`
- `Pillow`

## License

MIT License
