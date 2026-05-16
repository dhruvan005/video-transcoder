import { Test, TestingModule } from '@nestjs/testing';
import { MessageService } from './message.service';
import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

// Mock the SQS Client
jest.mock('@aws-sdk/client-sqs');

describe('MessageService', () => {
  let service: MessageService;
  let mockSQSClient: jest.Mocked<SQSClient>;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create module with MessageService
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessageService],
    }).compile();

    service = module.get<MessageService>(MessageService);
    mockSQSClient = service.MessageClient as jest.Mocked<SQSClient>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('receiveMessages', () => {
    it('should receive messages successfully', async () => {
      // Set environment variable
      process.env.QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
      process.env.AWS_REGION = 'us-east-1';

      const mockMessages = [
        { MessageId: 'msg-1', Body: '{"type": "video", "id": "123"}' },
        { MessageId: 'msg-2', Body: '{"type": "image", "id": "456"}' },
      ];

      // Mock the send method to return messages once, then no messages
      mockSQSClient.send = jest
        .fn()
        .mockResolvedValueOnce({ Messages: mockMessages })
        .mockResolvedValueOnce({ Messages: undefined }) // Second call returns no messages
        .mockRejectedValueOnce(new Error('Stop polling')); // Stop the while loop

      // Spy on console.log
      const consoleLogSpy = jest.spyOn(console, 'log');

      try {
        await service.receiveMessages();
      } catch (error) {
        // Expected to throw error to break while loop
      }

      // Verify messages were logged
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Received message: ',
        'msg-1',
        expect.stringContaining('video')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Received message: ',
        'msg-2',
        expect.stringContaining('image')
      );

      consoleLogSpy.mockRestore();
    });

    it('should throw error if QUEUE_URL is not defined', async () => {
      delete process.env.QUEUE_URL;

      await expect(service.receiveMessages()).rejects.toThrow(
        'QUEUE_URL is not defined in environment variables'
      );
    });

    it('should log "No messages received" when no messages available', async () => {
      process.env.QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';
      process.env.AWS_REGION = 'us-east-1';

      mockSQSClient.send = jest
        .fn()
        .mockResolvedValueOnce({ Messages: undefined })
        .mockRejectedValueOnce(new Error('Stop polling'));

      const consoleLogSpy = jest.spyOn(console, 'log');

      try {
        await service.receiveMessages();
      } catch (error) {
        // Expected
      }

      expect(consoleLogSpy).toHaveBeenCalledWith('No messages received');
      consoleLogSpy.mockRestore();
    });

    it('should handle SQS errors gracefully', async () => {
      process.env.QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/123456789/test-queue';

      const sqsError = new Error('SQS Service Error');
      mockSQSClient.send = jest.fn().mockRejectedValueOnce(sqsError);

      await expect(service.receiveMessages()).rejects.toThrow('SQS Service Error');
    });
  });
});
