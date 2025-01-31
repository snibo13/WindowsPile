import { useParams } from 'react-router-dom';
import styles from './Posts.module.scss';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import { useIndexContext } from 'renderer/context/IndexContext';
import Post from './Post';
import NewPost from '../NewPost';
import { AnimatePresence, motion } from 'framer-motion';
import debounce from 'renderer/utils/debounce';
import VirtualList from './VirtualList';

export default function Posts() {
  const { index, updateIndex } = useIndexContext();
  const [data, setData] = useState([]);

  // Index is updated when an entry is added/deleted.
  // We use this to generate the data array which consists of
  // all the items that are going to be rendered on the virtual list.
  useEffect(() => {
    const onlyParentEntries = Array.from(index)
      .filter(([key, metadata]) => !metadata.isReply)
      .reduce((acc, [key, value]) => acc.set(key, value), new Map());

    if (onlyParentEntries.size === data.length - 1) {
      return;
    }

    // Dummy entry appended to the front to account for the
    // NewPost component at the top of the list.
    setData([['NewPost', { height: 150 }], ...Array.from(onlyParentEntries)]);
  }, [index]);

  // When there are zero entries
  if (index.size == 0) {
    console.log('no entries');
    return (
      <div className={styles.posts}>
        <NewPost />
        <div className={styles.empty}>
          <div className={styles.wrapper}>
            <div className={styles.none}>Say something?</div>
            <div className={styles.tip}>
              Pile is ideal for journaling in bursts– type down what you're
              thinking right now, come back to it over time.
            </div>
          </div>
        </div>
      </div>
    );
  }
  console.log("Index size", index.size)
  console.log("Data in index", data)

  return (
    <div className={styles.posts}>
      <VirtualList data={data} />
    </div>
  );
}
