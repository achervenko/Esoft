export function createS3Client({ config, S3Client }) {
  return new S3Client({
    credentials: {
      accessKeyId: config.minio.accessKey,
      secretAccessKey: config.minio.secretKey,
    },
    endpoint: config.minio.endpoint,
    forcePathStyle: true,
    region: config.minio.region,
  });
}
