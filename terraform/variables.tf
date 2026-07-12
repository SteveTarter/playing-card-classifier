variable "aws_region" {
  type        = string
  description = "The AWS region to deploy all resources in."
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "The environment tag (e.g. dev, prod)."
  default     = "prod"
}

variable "backend_bucket_name" {
  type        = string
  description = "The name of the S3 bucket to store SageMaker model artifacts and raw image logs."
  default     = "card-classifier-backend-data"
}

variable "frontend_bucket_name" {
  type        = string
  description = "The name of the S3 bucket to store static frontend assets."
  default     = "react-card-classifier.tarterware.com"
}

variable "custom_domain" {
  type        = string
  description = "The custom domain name for the frontend (e.g., react-card-classifier.tarterware.com)."
  default     = "react-card-classifier.tarterware.com"
}

variable "acm_certificate_arn" {
  type        = string
  description = "The ACM Certificate ARN for CloudFront SSL. Required if custom_domain is set. Leave blank if not using custom domain."
  default     = ""
}

variable "route53_zone_name" {
  type        = string
  description = "Optional Route53 Hosted Zone name (e.g. tarterware.com) to automatically create domain record. Leave blank to skip Route53 creation."
  default     = ""
}

variable "deploy_serverless" {
  type        = bool
  description = "Whether to deploy the SageMaker endpoint in Serverless mode (scales to zero, saving cost) or Real-time mode (instance-based)."
  default     = true
}

variable "sagemaker_instance_type" {
  type        = string
  description = "The SageMaker instance type for Real-time mode (used only if deploy_serverless is false)."
  default     = "ml.m5.large"
}

variable "serverless_memory_size" {
  type        = number
  description = "Memory size in MB for SageMaker Serverless Inference (e.g., 2048, 3072, 4096, 6144)."
  default     = 2048
}

variable "serverless_max_concurrency" {
  type        = number
  description = "The maximum number of concurrent executions for SageMaker Serverless Inference."
  default     = 2
}

variable "sagemaker_ecr_image_uri" {
  type        = string
  description = "The ECR container image URI for TensorFlow inference. Defaults to AWS Deep Learning Containers (DLC) in us-east-1."
  default     = "763104351884.dkr.ecr.us-east-1.amazonaws.com/sagemaker-tensorflow-serving:2.13-cpu-py39-ubuntu20.04"
}

variable "s3_target_prefix" {
  type        = string
  description = "The folder structure prefix to store data in the backend bucket."
  default     = "raw_data/"
}

variable "allowed_origins" {
  type        = list(string)
  description = "List of whitelisted CORS origins for the Lambda backend."
  default     = []
}
