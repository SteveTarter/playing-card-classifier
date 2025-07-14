# Playing Card Classifier

This repository contains the code and resources for an AWS-based playing card classification system. The project leverages Amazon SageMaker for the machine learning model and AWS Lambda for a serverless API endpoint that processes image inputs and interacts with the SageMaker model.

## Project Structure

The project is organized into the following key directories:

* **`model/`**: Contains everything related to the SageMaker machine learning model, including training scripts, model artifacts, and deployment configurations.
    * For detailed information on the model, its training, and deployment, please refer to the [model README](model/README.md).

* **`lambda/`**: Houses the AWS Lambda function code that serves as the inference endpoint. This function handles incoming image data (via base64 encoding), preprocesses it, invokes the SageMaker model, and stores results.
    * For more specific details on the Lambda function's implementation, API Gateway integration, and usage, please see the [lambda-handler README](lambda-handler/README.md).

* **`docs/`**: Top-level system diagrams.

## Overview

The primary goal of this project is to provide a robust and scalable solution for identifying playing cards from images. Users can submit images to the Lambda API, which then utilizes the deployed SageMaker model to classify the card and return the predicted label and confidence. All inferences and original images are stored in an S3 bucket for auditing and further analysis.

## Getting Started

To set up and run this project, you will generally follow these steps:

1.  **Model Deployment:** Deploy the playing card classification model to Amazon SageMaker.
2.  **Lambda Function Deployment:** Deploy the Lambda function and configure an API Gateway endpoint to expose it.
3.  **S3 Bucket Configuration:** Ensure an S3 bucket is set up for storing input images and inference results, and update the Lambda function's configuration with the correct bucket name.

Please refer to the respective subdirectory READMEs for detailed setup and deployment instructions.

---
