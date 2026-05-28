import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import type { S3Event } from 'aws-lambda';

@Injectable()
export class MessageService implements OnModuleInit, OnModuleDestroy {
  public MessageClient: SQSClient = new SQSClient({
    region: process.env.AWS_REGION,
  });

  private ecsClient: ECSClient = new ECSClient({
    region: process.env.AWS_REGION,
  });

  private shouldStop = false;

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    this.receiveMessages().catch((err) =>
      console.error('SQS polling error', err),
    );
  }

  onModuleDestroy() {
    this.shouldStop = true;
  }

  async receiveMessages() {
    if (!process.env.QUEUE_URL) {
      throw new Error('QUEUE_URL is not defined in environment variables');
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: process.env.QUEUE_URL,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10,
    });

    while (!this.shouldStop) {
      try {
        const { Messages } = await this.MessageClient.send(command);
        if (Messages) {
          await Promise.all(Messages.map((message) => this.processMessage(message)));
        } else {
          console.log('No messages received');
        }
      } catch (err) {
        console.error('SQS receive error', err);
        throw err;
      }
    }
  }

  private async processMessage(message: { MessageId?: string; Body?: string; ReceiptHandle?: string }) {
    const { MessageId, Body, ReceiptHandle } = message;
    console.log('Received message:', MessageId);

    if (!Body || !ReceiptHandle) {
      console.warn(`Message ${MessageId} has no body, skipping`);
      return;
    }

    const event = JSON.parse(Body) as S3Event;

    if ('Service' in event && 'Event' in event) {
      if ((event as any).Event === 's3:TestEvent') {
        await this.deleteMessage(ReceiptHandle);
        return;
      }
    }

    await Promise.all(
      event.Records.map(async (record) => {
        const { bucket, object: { key } } = record.s3;
        const decodedKey = decodeURIComponent(key.replace(/\+/g, ' '));
        console.log(`Launching transcoder for s3://${bucket.name}/${decodedKey}`);
        await this.launchTranscoderTask(bucket.name, decodedKey);
      }),
    );

    await this.deleteMessage(ReceiptHandle);
  }

  private async launchTranscoderTask(bucketName: string, key: string) {
    const subnets = process.env.ECS_SUBNETS?.split(',') ?? [];

    const command = new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER_ARN,
      taskDefinition: process.env.ECS_TASK_DEFINITION_ARN,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets,
          assignPublicIp: 'ENABLED',
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: 'transcoder',
            environment: [{ name: 'KEY', value: key }],
          },
        ],
      },
    });

    const response = await this.ecsClient.send(command);
    console.log('ECS task launched:', response.tasks?.[0]?.taskArn);
  }

  private async deleteMessage(receiptHandle: string) {
    await this.MessageClient.send(
      new DeleteMessageCommand({
        QueueUrl: process.env.QUEUE_URL!,
        ReceiptHandle: receiptHandle,
      }),
    );
    console.log('Message deleted from queue');
  }
}
