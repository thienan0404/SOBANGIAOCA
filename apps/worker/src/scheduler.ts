import {Queue} from 'bullmq';

const url=process.env.REDIS_URL;
if(!url) throw new Error('REDIS_URL is required');

const connection={url};
const reminders=new Queue('reminder',{connection});
const timeBucket=Math.floor(Date.now()/600000);

try {
  await reminders.add('detect-overdue-shifts',{}, {
    jobId:`overdue-shifts-${timeBucket}`,
    removeOnComplete:100,
  });
  await reminders.add('detect-overdue-tasks',{}, {
    jobId:`overdue-tasks-${timeBucket}`,
    removeOnComplete:100,
  });
} finally {
  await reminders.close();
}