npm run build
aws s3 sync build/ s3://card-classifier.tarterware.com --delete
aws cloudfront create-invalidation   --distribution-id E25SWN0I50MC2O   --paths "/*"

