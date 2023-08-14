/**
 * These functions will be triggered when a new thread is created.
 *
 * 1. Update the stats in meta collection
 * 2. Send notifications to all users who have subscribed new thread
 *    notifications (except the creator of the thread)
 *
 */
import {getFirestore} from "firebase-admin/firestore";
import {getMessaging} from "firebase-admin/messaging";
import {
  FirestoreEvent,
  QueryDocumentSnapshot,
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";

const FIRESTORE_PATH = "stream/{threadId}";
const DEFAULT_TOPIC = "Yleinen";
const DEFAULT_ICON = "Adventurer";

export type metaStreamInfo = {
  slug: string,
  count: number,
  icon: string,
  description: string,
  order: number,
  name: string,
}

/**
 * Updates the stats in meta collection
 * @param {FirestoreEvent<QueryDocumentSnapshot |
 *   undefined, {threadId: string}>} event the Firestore event
 */
async function updateStats(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined,
  {threadId: string}>) {
  const topic = event.data?.data()?.topic || DEFAULT_TOPIC;

  const statsRef = getFirestore().collection("meta").doc("pelilauta");


  const stats = await statsRef.get();

  const topicArray:Array<metaStreamInfo> = stats.data()?.streams || [];

  // Find the index of the topic
  const topicIndex = topicArray.findIndex(
    (topicObject: metaStreamInfo) => topicObject.slug === topic);

  // If topic is not found, add it to the array
  if (topicIndex === -1) {
    topicArray.push({
      slug: topic,
      count: 1,
      icon: DEFAULT_ICON,
      description: "",
      order: -1,
      name: topic,
    });
  } else {
    // If topic is found, increment the count
    topicArray[topicIndex].count++;
  }

  // Update the stats
  await statsRef.update({topics: topicArray});
}

/**
 * Sends notifications to all users who have subscribed new thread
 * notifications (except the creator of the thread)
 * @param {FirestoreEvent<QueryDocumentSnapshot |
 *  undefined, {threadId: string}>} event the Firestore event
 */
async function notifyOnThreadCreated(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined,
  {threadId: string}>) {
  const messaging = getMessaging();

  const subscribers = await getFirestore().collection("subscriptions").where(
    "notifyOnThreads", "==", true).get();

  const thread = event.data?.data();
  const threadId = event.data?.id;

  if (!thread) {
    throw new Error(
      "Trying to send notification for non-existing thread");
  }

  const author = await getFirestore().collection("profiles").doc(
    thread.author).get();
  const authorData = author.data();
  const nick = authorData?.nick || "Anonyymi";

  const title = thread.title || "Nimetön";
  const body = thread.topic ? nick + " loi uuden ketjun aiheessa " +
        thread.topic : nick + " loi uuden ketjun";

  subscribers.forEach((subscriber) => {
    logger.info("Sending notification to: " + subscriber.id);
    subscriber.data().messagingTokens.forEach((token: string) => {
      logger.info("Sending notification to token: " + token);
      messaging.send({
        token: token,
        notification: {
          title,
          body,
        },
        data: {
          threadId: threadId || "",
          url: `https://pelilauta.web.app/threads/${threadId}`,
        },
      });
    });
  });
  logger.info("Sent notifications for new thread: " + threadId);
  return Promise.resolve();
}


export const onThreadCreated = onDocumentCreated(
  FIRESTORE_PATH,
  async (event) => {
    await updateStats(event);
    await notifyOnThreadCreated(event);

    return Promise.resolve();
  }
);
