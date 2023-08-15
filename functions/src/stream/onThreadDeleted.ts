/**
 * These functions will be triggered when a new thread is created.
 *
 * 1. Update the stats in meta collection
 */
import {getFirestore} from "firebase-admin/firestore";
import {
  FirestoreEvent,
  QueryDocumentSnapshot,
  onDocumentDeleted,
} from "firebase-functions/v2/firestore";

import {metaStreamInfo} from "./onThreadCreated";

const FIRESTORE_PATH = "stream/{threadId}";

/**
 * Reduces the count of the topic in meta collection
 *
 * @param {FirestoreEvent<QueryDocumentSnapshot | undefined>} event
 *   the Firestore event
 */
async function updateStats(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined>) {
  const topic = event.data?.data()?.topic || "Yleinen";

  const statsRef = getFirestore().collection("meta").doc("pelilauta");
  const stats = await statsRef.get();
  const streams = stats.data()?.streams || {};

  if (streams[topic]) {
    const streamInfo = streams[topic] as metaStreamInfo;
    streamInfo.count = streamInfo.count ? streamInfo.count - 1 : 0;
  }

  await statsRef.update({
    streams,
  });
}

export const onThreadDeleted = onDocumentDeleted(
  FIRESTORE_PATH,
  async (event: FirestoreEvent<QueryDocumentSnapshot | undefined>) => {
    await updateStats(event);
  });
