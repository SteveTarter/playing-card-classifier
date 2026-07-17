tar -czvf model.tar.gz -C export/saved_model 1
aws s3 cp model.tar.gz s3://sagemaker-playing-card-classification-model/
aws sagemaker delete-model --model-name playing-card-classification-model
aws sagemaker create-model --model-name playing-card-classification-model --primary-container Image=763104351884.dkr.ecr.us-east-1.amazonaws.com/tensorflow-inference:2.13-cpu-py310,ModelDataUrl=https://sagemaker-playing-card-classification-model.s3.us-east-1.amazonaws.com/model.tar.gz --execution-role arn:aws:iam::755935564186:role/AmazonSageMaker-ExecutionRole-CardClassifier
aws sagemaker delete-endpoint-config --endpoint-config-name playing-card-classification-config
aws sagemaker create-endpoint-config --endpoint-config-name playing-card-classification-config --production-variants VariantName=AllTraffic,ModelName=playing-card-classification-model,InitialInstanceCount=1,InstanceType=ml.m5.large 
aws sagemaker delete-endpoint   --endpoint-name playing-card-classification-endpoint
aws sagemaker create-endpoint   --endpoint-name playing-card-classification-endpoint --endpoint-config-name playing-card-classification-config

