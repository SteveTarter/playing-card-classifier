locals {
  use_custom_domain = var.custom_domain != "" && var.acm_certificate_arn != ""
  aliases           = local.use_custom_domain ? [var.custom_domain] : []

  # Derive name prefix from the custom domain subdomain (e.g., "test-card-classifier")
  # Fall back to "playing-card-classifier" if custom domain is not specified
  model_prefix = var.custom_domain != "" ? split(".", var.custom_domain)[0] : "playing-card-classifier"
  sagemaker_model_name    = "${local.model_prefix}-model"
  sagemaker_config_name   = "${local.model_prefix}-config"
  sagemaker_endpoint_name = "${local.model_prefix}-endpoint"
}

# ==========================================
# 1. FRONTEND INFRASTRUCTURE (S3 & CloudFront)
# ==========================================

# S3 Bucket for Static Website Assets
resource "aws_s3_bucket" "frontend" {
  bucket        = var.frontend_bucket_name
  force_destroy = true

  tags = {
    Name        = "card-classifier-frontend"
    Environment = var.environment
  }
}

# Block Public Access to Frontend Bucket (Access only via CloudFront OAC)
resource "aws_s3_bucket_public_access_block" "frontend_block_public" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CloudFront Origin Access Control (OAC)
resource "aws_cloudfront_origin_access_control" "oac" {
  name                              = "frontend-oac-${var.environment}"
  description                       = "OAC for static React frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "S3FrontEnd"
    origin_access_control_id = aws_cloudfront_origin_access_control.oac.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = local.aliases

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3FrontEnd"

    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # Managed CachingOptimized policy
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn            = local.use_custom_domain ? var.acm_certificate_arn : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : "TLSv1.2_2021"
    cloudfront_default_certificate = local.use_custom_domain ? false : true
  }

  # Route fallback to index.html for Single Page Application
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  tags = {
    Environment = var.environment
  }
}

# S3 Bucket Policy to Allow CloudFront access
resource "aws_s3_bucket_policy" "frontend_policy" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowCloudFrontServicePrincipalGetObject"
        Effect   = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })
}

# Route53 DNS record (optional)
data "aws_route53_zone" "zone" {
  count = var.route53_zone_name != "" ? 1 : 0
  name  = var.route53_zone_name
}

resource "aws_route53_record" "dns" {
  count   = var.route53_zone_name != "" && local.use_custom_domain ? 1 : 0
  zone_id = data.aws_route53_zone.zone[0].zone_id
  name    = var.custom_domain
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.frontend.domain_name
    zone_id                = aws_cloudfront_distribution.frontend.hosted_zone_id
    evaluate_target_health = false
  }
}


# ==========================================
# 2. BACKEND STORAGE & MODEL ARTIFACTS
# ==========================================

# S3 Bucket for model artifacts & predictions
data "aws_s3_bucket" "backend" {
  bucket = var.backend_bucket_name
}

# Upload model.tar.gz to S3
resource "aws_s3_object" "model_tar" {
  bucket = data.aws_s3_bucket.backend.bucket
  key    = "model/model.tar.gz"
  source = "${path.module}/../model/model.tar.gz"
  etag   = filemd5("${path.module}/../model/model.tar.gz")
}


# ==========================================
# 3. SAGEMAKER ENDPOINT (Serverless / Real-time)
# ==========================================

# SageMaker Execution Role
resource "aws_iam_role" "sagemaker_role" {
  name = "card-classifier-sagemaker-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policies for SageMaker
resource "aws_iam_role_policy" "sagemaker_policy" {
  name = "card-classifier-sagemaker-policy-${var.environment}"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          data.aws_s3_bucket.backend.arn,
          "${data.aws_s3_bucket.backend.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      }
    ]
  })
}

# SageMaker Model
resource "aws_sagemaker_model" "model" {
  name               = local.sagemaker_model_name
  execution_role_arn = aws_iam_role.sagemaker_role.arn

  primary_container {
    image          = var.sagemaker_ecr_image_uri
    model_data_url = "s3://${data.aws_s3_bucket.backend.bucket}/${aws_s3_object.model_tar.key}"
  }
}

# SageMaker Endpoint Configuration
resource "aws_sagemaker_endpoint_configuration" "endpoint_config" {
  name = local.sagemaker_config_name

  production_variants {
    variant_name           = "AllTraffic"
    model_name             = aws_sagemaker_model.model.name
    instance_type          = var.deploy_serverless ? null : var.sagemaker_instance_type
    initial_instance_count = var.deploy_serverless ? null : 1

    dynamic "serverless_config" {
      for_each = var.deploy_serverless ? [1] : []
      content {
        max_concurrency   = var.serverless_max_concurrency
        memory_size_in_mb = var.serverless_memory_size
      }
    }
  }

  tags = {
    Environment = var.environment
  }
}

# SageMaker Endpoint
resource "aws_sagemaker_endpoint" "endpoint" {
  name                 = local.sagemaker_endpoint_name
  endpoint_config_name = aws_sagemaker_endpoint_configuration.endpoint_config.name

  tags = {
    Environment = var.environment
  }
}


# ==========================================
# 4. LAMBDA FUNCTION
# ==========================================

# Build Lambda package dependencies using the helper script
resource "null_resource" "build_lambda" {
  triggers = {
    requirements_hash = filemd5("${path.module}/../lambda/requirements.txt")
    app_hash          = filemd5("${path.module}/../lambda/app.py")
    script_hash       = filemd5("${path.module}/build_lambda.sh")
  }

  provisioner "local-exec" {
    command = "bash ${path.module}/build_lambda.sh"
  }
}

# Lambda Execution Role
resource "aws_iam_role" "lambda_role" {
  name = "card-classifier-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM Policies for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "card-classifier-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sagemaker:InvokeEndpoint"
        ]
        Resource = aws_sagemaker_endpoint.endpoint.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${data.aws_s3_bucket.backend.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = data.aws_s3_bucket.backend.arn
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_log_group" {
  name              = "/aws/lambda/card-classifier-backend"
  retention_in_days = 14
}

# AWS Lambda Function
resource "aws_lambda_function" "classifier_lambda" {
  filename      = "${path.module}/lambda.zip"
  function_name = "card-classifier-backend"
  role          = aws_iam_role.lambda_role.arn
  handler       = "app.lambda_handler"
  runtime       = "python3.9"
  timeout       = 60
  memory_size   = 512
  source_code_hash = filebase64sha256("${path.module}/lambda.zip")

  environment {
    variables = {
      BUCKET_NAME             = data.aws_s3_bucket.backend.bucket
      S3_TARGET_PREFIX        = var.s3_target_prefix
      SAGEMAKER_ENDPOINT_NAME = aws_sagemaker_endpoint.endpoint.name
      ALLOWED_ORIGINS         = join(",", concat(var.custom_domain != "" ? ["https://${var.custom_domain}"] : [], var.allowed_origins))
    }
  }

  depends_on = [
    null_resource.build_lambda,
    aws_cloudwatch_log_group.lambda_log_group
  ]
}


# ==========================================
# 5. API GATEWAY
# ==========================================

resource "aws_api_gateway_rest_api" "api" {
  name        = "card-classifier-api-${var.environment}"
  description = "API Gateway for Playing Card Classifier"
}

# Resource: /predictCardLabel
resource "aws_api_gateway_resource" "predict" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "predictCardLabel"
}

# Method: POST /predictCardLabel
resource "aws_api_gateway_method" "post_predict" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.predict.id
  http_method   = "POST"
  authorization = "NONE"
}

# Method: OPTIONS /predictCardLabel (CORS Preflight)
resource "aws_api_gateway_method" "options_predict" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.predict.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Integration: POST -> Lambda
resource "aws_api_gateway_integration" "post_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.predict.id
  http_method             = aws_api_gateway_method.post_predict.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.classifier_lambda.invoke_arn
}

# Integration: OPTIONS -> Lambda (since app.py handles CORS preflight itself)
resource "aws_api_gateway_integration" "options_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.predict.id
  http_method             = aws_api_gateway_method.options_predict.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.classifier_lambda.invoke_arn
}

# Cognito Authorizer
resource "aws_api_gateway_authorizer" "cognito" {
  name          = "card-classifier-cognito-authorizer"
  type          = "COGNITO_USER_POOLS"
  rest_api_id   = aws_api_gateway_rest_api.api.id
  provider_arns = [var.cognito_user_pool_arn]
}

# Resource: /grading
resource "aws_api_gateway_resource" "grading" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "grading"
}

# Method: GET /grading
resource "aws_api_gateway_method" "get_grading" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.grading.id
  http_method   = "GET"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

# Method: POST /grading
resource "aws_api_gateway_method" "post_grading" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.grading.id
  http_method   = "POST"
  authorization = "COGNITO_USER_POOLS"
  authorizer_id = aws_api_gateway_authorizer.cognito.id
}

# Method: OPTIONS /grading (CORS preflight)
resource "aws_api_gateway_method" "options_grading" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.grading.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# Integration: GET /grading -> Lambda
resource "aws_api_gateway_integration" "get_grading_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.grading.id
  http_method             = aws_api_gateway_method.get_grading.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.classifier_lambda.invoke_arn
}

# Integration: POST /grading -> Lambda
resource "aws_api_gateway_integration" "post_grading_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.grading.id
  http_method             = aws_api_gateway_method.post_grading.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.classifier_lambda.invoke_arn
}

# Integration: OPTIONS /grading -> Lambda
resource "aws_api_gateway_integration" "options_grading_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.grading.id
  http_method             = aws_api_gateway_method.options_grading.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.classifier_lambda.invoke_arn
}

# Lambda Permissions for API Gateway
resource "aws_lambda_permission" "apigw_post" {
  statement_id  = "AllowAPIGatewayInvokePost"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.classifier_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "apigw_options" {
  statement_id  = "AllowAPIGatewayInvokeOptions"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.classifier_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# Deployment
resource "aws_api_gateway_deployment" "api_deploy" {
  rest_api_id = aws_api_gateway_rest_api.api.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.predict.id,
      aws_api_gateway_method.post_predict.id,
      aws_api_gateway_method.options_predict.id,
      aws_api_gateway_integration.post_integration.id,
      aws_api_gateway_integration.options_integration.id,
      aws_api_gateway_resource.grading.id,
      aws_api_gateway_method.get_grading.id,
      aws_api_gateway_method.post_grading.id,
      aws_api_gateway_method.options_grading.id,
      aws_api_gateway_integration.get_grading_integration.id,
      aws_api_gateway_integration.post_grading_integration.id,
      aws_api_gateway_integration.options_grading_integration.id
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.post_integration,
    aws_api_gateway_integration.options_integration,
    aws_api_gateway_integration.get_grading_integration,
    aws_api_gateway_integration.post_grading_integration,
    aws_api_gateway_integration.options_grading_integration
  ]
}

# Stage
resource "aws_api_gateway_stage" "api_stage" {
  deployment_id = aws_api_gateway_deployment.api_deploy.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}
