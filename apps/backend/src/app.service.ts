import { Injectable } from '@nestjs/common';
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import AWS from 'aws-sdk';
import { ReadStream, createWriteStream } from 'fs';



@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async uploadToS3(fileStream: ReadStream, s3Key: string) {
    try {
      const params : AWS.S3.Types.PutObjectRequest = {
        Bucket: 'your-bucket-name',
        Key: s3Key,
        Body: fileStream,
        ContentType: 'video/mp4',
      };
    } catch (error) {
      console.error('Error uploading file to S3:', error);
    }
    return { fileStream: null, s3Key: 'example-key' };
  }
}
