npm run build
aws s3 sync build/ s3://card-classifier.tarterware.com --delete
aws cloudfront create-invalidation   --distribution-id E1H18SF5V69IR5   --paths "/*"

