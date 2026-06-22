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
        if (Messages?.length) {
          // allSettled so one failing message never aborts the batch,
          // and processMessage swallows its own errors so we keep polling.
          await Promise.allSettled(
            Messages.map((message) => this.processMessage(message)),
          );
        } else {
          console.log('No messages received');
        }
      } catch (err) {
        // Do NOT re-throw: that would exit the loop and stop the consumer
        // permanently. Log and keep polling so transient errors recover.
        console.error('SQS receive error', err);
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

    try {
      const event = JSON.parse(Body) as S3Event;

      if ('Service' in event && 'Event' in event) {
        if ((event as any).Event === 's3:TestEvent') {
          await this.deleteMessage(ReceiptHandle);
          return;
        }
      }

      if (!Array.isArray(event.Records)) {
        console.warn(
          `Message ${MessageId} has no S3 Records, skipping:`,
          Body,
        );
        return;
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
    } catch (err) {
      // Leave the message on the queue (it becomes visible again after the
      // visibility timeout) so it retries and eventually hits the DLQ after
      // maxReceiveCount. Never throw here — that would kill the polling loop.
      console.error(`Failed to process message ${MessageId}`, err);
    }
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
