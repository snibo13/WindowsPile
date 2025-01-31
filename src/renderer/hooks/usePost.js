import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePilesContext } from 'renderer/context/PilesContext';
import * as fileOperations from '../utils/fileOperations';
import { useIndexContext } from 'renderer/context/IndexContext';
import {
  getPost,
  cycleColorCreator,
  tagActionsCreator,
  attachToPostCreator,
  detachFromPostCreator,
  setHighlightCreator,
} from './usePostHelpers';

const highlightColors = [
  'var(--border)',
  'var(--base-yellow)',
  'var(--base-green)',
];

const defaultPost = {
  content: '',
  data: {
    title: '',
    createdAt: null,
    updatedAt: null,
    highlight: null,
    highlightColor: null,
    tags: [],
    replies: [],
    attachments: [],
    isReply: false,
    isAI: false,
  },
};

function usePost(
  postPath = null, // relative path
  {
    isReply = false,
    isAI = false,
    parentPostPath = null, // relative path
    reloadParentPost = () => {},
  } = {}
) {
  const { currentPile, getCurrentPilePath } = usePilesContext();
  const { addIndex, removeIndex, refreshIndex } = useIndexContext();
  const [updates, setUpdates] = useState(0);
  const [path, setPath] = useState(); // absolute path
  const [post, setPost] = useState({ ...defaultPost });

  useEffect(() => {
    if (!postPath) return;
    // const fullPath = window.electron.joinPath(getCurrentPilePath(), postPath);
    setPath(postPath);
  }, [postPath, currentPile]);

  useEffect(() => {
    if (!path) return;
    refreshPost();
  }, [path]);

  const refreshPost = useCallback(async () => {
    console.log("Refreshing post")
    if (!path) return;
    console.log("Path in refresh post", path)
    const freshPost = await getPost(path);
    console.log("Got post")
    console.log(freshPost)
    setPost(freshPost);
    console.log("Refreshed")
  }, [path]);

  const savePost = useCallback(
    async (dataOverrides) => {
      const saveToPath = path
        ? path
        : fileOperations.getFilePathForNewPost(currentPile.path);

      const directoryPath = fileOperations.getDirectoryPath(saveToPath);
      const now = new Date().toISOString();
      const content = post.content;
      const data = {
        ...post.data,
        isAI: post.data.isAI === true ? post.data.isAI : isAI,
        isReply: post.data.createdAt ? post.data.isReply : isReply,
        createdAt: post.data.createdAt ?? now,
        updatedAt: now,
        ...dataOverrides,
      };

      try {
        console.log("Saving post")
        const fileContents = await fileOperations.generateMarkdown(
          content,
          data
        );
        console.log("Contents generated")
        console.log(content)
        console.log(data)
        console.log(directoryPath)
        await fileOperations.createDirectory(directoryPath);
        console.log("Directory created")
        await fileOperations.saveFile(saveToPath, fileContents);
        console.log("File saved")

        if (isReply) {
          await addReplyToParent(parentPostPath, saveToPath);
        }

        const postRelativePath = saveToPath.replace(
          getCurrentPilePath() + '/',
          ''
        );
        console.log(`Saved file: ${saveToPath}`);
        console.log(parentPostPath);
        console.log("Post relative path", postRelativePath);
        addIndex(postRelativePath, parentPostPath); // Add the file to the index
        window.electron.ipc.invoke('tags-sync', saveToPath); // Sync tags
        
      } catch (error) {
        console.error(`Error writing file: ${saveToPath}`);
        console.error(error);
      }
    },
    [path, post, reloadParentPost]
  );

  const addReplyToParent = async (parentPostPath, replyPostPath) => {
    console.log("Adding reply to parent")
    const relativeReplyPath = replyPostPath.split('/').slice(-3).join('/');
    const fullParentPostPath = parentPostPath;
    console.log("Full parent post path", fullParentPostPath)
    const parentPost = await getPost(fullParentPostPath);
    const content = parentPost.content;
    const data = {
      ...parentPost.data,
      replies: [...parentPost.data.replies, relativeReplyPath],
    };
    const fileContents = await fileOperations.generateMarkdown(content, data);
    console.log("Contents", fileContents)
    await fileOperations.saveFile(fullParentPostPath, fileContents);
    reloadParentPost(parentPostPath);
  };

  const deletePost = useCallback(async () => {
    if (!postPath) return null;
    const fullPostPath = getCurrentPilePath(postPath);

    // if reply, remove from parent
    if (post.data.isReply && parentPostPath) {
      const fullParentPostPath = getCurrentPilePath(parentPostPath);
      const parentPost = await getPost(fullParentPostPath);
      const content = parentPost.content;
      const newReplies = parentPost.data.replies.filter((p) => {
        return p !== postPath;
      });
      const data = {
        ...parentPost.data,
        replies: newReplies,
      };
      const fileContents = await fileOperations.generateMarkdown(content, data);
      await fileOperations.saveFile(fullParentPostPath, fileContents);
      await reloadParentPost();
    }

    // delete file and remove from index
    await fileOperations.deleteFile(fullPostPath);
    removeIndex(postPath);
  }, [postPath, reloadParentPost, parentPostPath, post]);

  const postActions = useMemo(
    () => ({
      setContent: (content) => setPost((post) => ({ ...post, content })),
      updateData: (data) =>
        setPost((post) => ({ ...post, data: { ...post.data, ...data } })),
      cycleColor: cycleColorCreator(post, setPost, savePost, highlightColors),
      setHighlight: setHighlightCreator(post, setPost, savePost),
      addTag: tagActionsCreator(setPost, 'add'),
      removeTag: tagActionsCreator(setPost, 'remove'),
      attachToPost: attachToPostCreator(setPost, getCurrentPilePath),
      detachFromPost: detachFromPostCreator(setPost, getCurrentPilePath),
      resetPost: () => setPost(defaultPost),
    }),
    [post]
  );

  return {
    defaultPost,
    post,
    savePost,
    refreshPost,
    deletePost,
    ...postActions,
  };
}

export default usePost;
