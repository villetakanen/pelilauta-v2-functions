import {getFirestore} from "firebase-admin/firestore";
import {onDocumentDeleted} from "firebase-functions/v2/firestore";

const FIRESTORE_PATH = "stream/{threadKey}/comments/{replyKey}";

/**
 * Updates the stats in the thread
 *
 * @param {string} threadKey the thread key
 */
async function updateStats(threadKey: string) {
  // -- the reply count for the thread
  const threadRef = getFirestore().collection("stream").doc(threadKey);
  const thread = await threadRef.get();
  const count = thread.data()?.replyCount || 0;
  // Update the replyCount in db
  if (count >= 0) await threadRef.update({replyCount: count - 1});
}

export const onReplyToThreadDeleted = onDocumentDeleted(
  FIRESTORE_PATH,
  async (event) => {
    const threadKey = event.params?.threadKey;
    await updateStats(threadKey);
  }
);
