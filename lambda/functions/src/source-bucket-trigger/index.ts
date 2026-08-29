import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import type { S3Event } from "aws-lambda";

const ecs = new ECSClient({ region: process.env.AWS_REGION });

const CLUSTER_ARN = process.env.ECS_CLUSTER_ARN;
const TASK_DEFINITION_ARN = process.env.ECS_TASK_DEFINITION_ARN;
const SUBNETS = process.env.ECS_SUBNETS?.split(",").filter(Boolean) ?? [];
const SECURITY_GROUPS =
  process.env.ECS_SECURITY_GROUP_ID?.split(",").filter(Boolean) ?? [];

/**
 * S3 ObjectCreated → launch one Fargate transcoder task per uploaded object.
 * Ported from the old NestJS polling service (message.service.ts): the S3
 * event now invokes this Lambda directly instead of going through SQS.
 */
export const handler = async (event: S3Event): Promise<void> => {
  for (const record of event.Records) {
    const bucket = record.s3.bucket.name;
    // S3 URL-encodes keys (spaces → '+'); decode before handing to the task.
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    console.log(`Launching transcoder for s3://${bucket}/${key}`);
    await launchTranscoderTask(key);
  }
};

async function launchTranscoderTask(key: string): Promise<void> {
  const command = new RunTaskCommand({
    cluster: CLUSTER_ARN,
    taskDefinition: TASK_DEFINITION_ARN,
    launchType: "FARGATE",
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: SUBNETS,
        securityGroups: SECURITY_GROUPS,
        assignPublicIp: "ENABLED",
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "transcoder",
          environment: [{ name: "KEY", value: key }],
        },
      ],
    },
  });

  const response = await ecs.send(command);
  console.log("ECS task launched:", response.tasks?.[0]?.taskArn);
}
