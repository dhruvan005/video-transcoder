import { Injectable } from '@nestjs/common';
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  uploadToS3(): string {
    // Here you would implement the logic to upload a file to S3
    // For example, you could use the AWS SDK for JavaScript to interact with S3
    // This is just a placeholder implementation
    return 'File uploaded to S3 successfully!';
  }
}
