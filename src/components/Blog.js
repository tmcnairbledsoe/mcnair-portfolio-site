import React, { useState, useEffect, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { CosmosClient } from "@azure/cosmos";
import { BlobServiceClient } from "@azure/storage-blob";

const Blog = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims.roles || [];
  const isOwner = roles.includes("OwnerRole");

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [editPost, setEditPost] = useState(null); // Track the post being edited
  const [showPostForm, setShowPostForm] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Cosmos DB and Blob Storage configuration
  const endpoint = process.env.REACT_APP_COSMOS_DB_ENDPOINT;
  const key = process.env.REACT_APP_COSMOS_DB_KEY;
  const blobAccountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const blobSasToken = process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN;

  const cosmosClient = useMemo(() => new CosmosClient({ endpoint, key }), [endpoint, key]);
  const container = cosmosClient.database("Posts").container("Posts");

  const blobServiceClient = useMemo(() => new BlobServiceClient(
    `https://${blobAccountName}.blob.core.windows.net?${blobSasToken}`
  ), [blobAccountName, blobSasToken]);

  const blobContainerClient = useMemo(() => blobServiceClient.getContainerClient("posts"), [blobServiceClient]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const { resources: items } = await container.items.query("SELECT * FROM c WHERE c.postType = 'blog' ORDER BY c.datePosted DESC").fetchAll();
        setPosts(items);
        setDataLoaded(true);
      } catch (error) {
        console.error("Error fetching blog posts:", error);
      }
    };

    if (!dataLoaded) {
      fetchPosts();
    }
  }, [container, dataLoaded]);

  const handleCreatePost = async () => {
    const datePosted = new Date().toISOString();
    const newDocument = {
      id: datePosted,
      partitionKey: "blog",
      title: newPost.title,
      content: newPost.content,
      datePosted: datePosted,
      postType: "blog",
    };

    try {
      await container.items.create(newDocument);
      setPosts([newDocument, ...posts]);
      setShowPostForm(false);
      setNewPost({ title: "", content: "" });
    } catch (error) {
      console.error("Error creating blog post:", error);
    }
  };

  const handleUpdatePost = async () => {
    const updatedPost = {
      ...editPost,
      title: newPost.title,
      content: newPost.content,
    };

    try {
      await container.item(editPost.id, editPost.partitionKey).replace(updatedPost);
      setPosts(posts.map((post) => (post.id === editPost.id ? updatedPost : post)));
      setEditPost(null);
      setNewPost({ title: "", content: "" });
    } catch (error) {
      console.error("Error updating blog post:", error);
    }
  };

  const handleEditPost = (post) => {
    setEditPost(post);
    setNewPost({ title: post.title, content: post.content });
  };

  const handleCancelEdit = () => {
    setEditPost(null);
    setNewPost({ title: "", content: "" });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const datePosted = new Date().toISOString();
      const fileName = `${datePosted}-${file.name}`;
      try {
        const blobClient = blobContainerClient.getBlockBlobClient(fileName);
        await blobClient.uploadData(file, {
          blobHTTPHeaders: { blobContentType: file.type },
        });
        const fileUrl = blobClient.url;
        setNewPost((prevPost) => ({
          ...prevPost,
          content: `${prevPost.content}<img src="${fileUrl}" alt="${file.name}" />`,
        }));
      } catch (error) {
        console.error("Error uploading file:", error);
      }
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ textAlign: "center" }}>Blog</h2>

      {/* Create or Edit Post Form */}
      {(isOwner && showPostForm) || editPost ? (
        <div style={{ marginBottom: "20px", padding: "0 20px", textAlign: "left", display: "flex", gap: "20px" }}>
          <div
            style={{ flex: "1", padding: "10px", border: "1px solid #ccc", minHeight: "400px" }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="text"
              placeholder="Title"
              value={newPost.title}
              onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
              style={{ width: "100%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }}
            />
            <textarea
              placeholder="Write your HTML content here..."
              value={newPost.content}
              onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
              style={{ width: "100%", height: "300px", padding: "10px", boxSizing: "border-box" }}
            />
          </div>
          <div
            style={{ flex: "1", padding: "10px", border: "1px solid #ccc", minHeight: "400px", backgroundColor: "#f9f9f9" }}
            dangerouslySetInnerHTML={{ __html: newPost.content }}
          />
        </div>
      ) : null}

      {(isOwner && showPostForm) && (
        <div>
          <button
            style={{ padding: "10px 15px", cursor: "pointer", marginRight: "20px" }}
            onClick={handleCreatePost}
          >
            Submit Post
          </button>
          <button
            style={{ padding: "10px 15px", cursor: "pointer" }}
            onClick={() => setShowPostForm(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Post Listing */}
      <div>
        {posts.map((post) => (
          <div key={post.id} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
            <h2>{post.title}</h2>
            <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.content }} />
            <p><small>{new Date(post.datePosted).toLocaleDateString()}</small></p>
            {isOwner && (
              <button
                style={{ padding: "5px 10px", cursor: "pointer", marginRight: "10px" }}
                onClick={() => handleEditPost(post)}
              >
                Edit
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit controls */}
      {editPost && (
        <div>
          <button
            style={{ padding: "10px 15px", cursor: "pointer", marginRight: "20px" }}
            onClick={handleUpdatePost}
          >
            Save Changes
          </button>
          <button
            style={{ padding: "10px 15px", cursor: "pointer" }}
            onClick={handleCancelEdit}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default Blog;
