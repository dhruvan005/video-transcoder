import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ReceiveMessageCommand, SQSClient } from '@aws-sdk/client-sqs'

@Injectable()
export class MessageService implements OnModuleInit, OnModuleDestroy {

  public MessageClient: SQSClient = new SQSClient({
    region: process.env.AWS_REGION,
  })

  private shouldStop = false

  // Start polling when the module initializes (skip in tests)
  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return
    // start polling in background without blocking bootstrap
    this.receiveMessages().catch(err => console.error('SQS polling error', err))
  }

  onModuleDestroy() {
    this.shouldStop = true
  }

  async receiveMessages() {
    if (!process.env.QUEUE_URL) {
      throw new Error("QUEUE_URL is not defined in environment variables")
    }

    while (!this.shouldStop) {
      const command = new ReceiveMessageCommand({
        QueueUrl: process.env.QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 10,
      })

      try {
        const { Messages } = await this.MessageClient.send(command)
        if (Messages) {
          for (const message of Messages) {
            console.log("Received message: ", message.MessageId, message.Body)
            // Process the message here
          }
        } else {
          console.log("No messages received")
        }
      } catch (err) {
        // Let errors propagate for tests that expect failures
        console.error('SQS receive error', err)
        throw err
      }
    }
  }
}