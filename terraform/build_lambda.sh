#!/bin/bash
# Exit on any error
set -e

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LAMBDA_DIR="$SCRIPT_DIR/../lambda"

echo "Packaging Lambda function in $LAMBDA_DIR..."

# Move to Lambda directory
cd "$LAMBDA_DIR"

# Clean up previous builds
rm -rf lambda_build lambda.zip "$SCRIPT_DIR/lambda.zip"

# Create temporary build folder
mkdir -p lambda_build

# Install dependencies (numpy and Pillow) to the build folder
# We use --platform, --implementation, and --only-binary to ensure compatibility
# with the AWS Lambda Python runtime.
pip install -r requirements.txt -t lambda_build/ \
  --only-binary=:all: \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.9 \
  --upgrade

# Copy application code into build folder
cp app.py lambda_build/

# Zip the package
cd lambda_build
zip -r ../lambda.zip .
cd ..

# Move the zip back to the terraform directory
mv lambda.zip "$SCRIPT_DIR/lambda.zip"

# Clean up the build folder
rm -rf lambda_build

echo "Lambda package built successfully at $SCRIPT_DIR/lambda.zip"
