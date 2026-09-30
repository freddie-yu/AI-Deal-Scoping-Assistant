// Small application-owned catalog. Services are customer-solution recommendations,
// never dependencies of this local assistant.
export const AWS_CATALOG = {
  'aws:cloudfront': { name: 'Amazon CloudFront', role: 'FRONTEND' },
  'aws:s3': { name: 'Amazon S3', role: 'FRONTEND' },
  'aws:api-gateway': { name: 'Amazon API Gateway', role: 'INTEGRATION' },
  'aws:lambda': { name: 'AWS Lambda', role: 'BACKEND' },
  'aws:rds-postgresql': { name: 'Amazon RDS for PostgreSQL', role: 'DATABASE' },
  'aws:cognito': { name: 'Amazon Cognito', role: 'BACKEND' },
  'aws:sqs': { name: 'Amazon SQS', role: 'INTEGRATION' },
  'aws:bedrock': { name: 'Amazon Bedrock', role: 'AI' },
  'aws:cloudwatch': { name: 'Amazon CloudWatch', role: 'BACKEND' },
  'aws:kms': { name: 'AWS KMS', role: 'BACKEND' },
  'aws:secrets-manager': { name: 'AWS Secrets Manager', role: 'INTEGRATION' },
} as const;
export type ServiceKey = keyof typeof AWS_CATALOG;
export const AWS_CATALOG_VERSION = 'phase2-1';
export function isServiceKey(key: string): key is ServiceKey { return Object.hasOwn(AWS_CATALOG, key); }
