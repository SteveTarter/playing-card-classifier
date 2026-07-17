output "api_endpoint_url" {
  value       = aws_api_gateway_stage.api_stage.invoke_url
  description = "The invocation URL for the API Gateway stage (point your frontend API_BASE_URL here)."
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.frontend.domain_name
  description = "The domain name of the CloudFront distribution."
}

output "s3_frontend_bucket" {
  value       = aws_s3_bucket.frontend.id
  description = "The S3 bucket name for hosting the React frontend assets."
}

output "sagemaker_endpoint_name" {
  value       = aws_sagemaker_endpoint.endpoint.name
  description = "The name of the SageMaker endpoint."
}
