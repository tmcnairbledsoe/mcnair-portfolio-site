import React, { useState, useEffect } from "react";
import { useMsal } from "@azure/msal-react";
import { TableClient, AzureSASCredential } from "@azure/data-tables";

const Blog = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims.roles || [];
  const isOwner = roles.includes("OwnerRole");

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", text: "" });
  const [showPostForm, setShowPostForm] = useState(false);

  const tableName = "Posts";
  const accountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN;
  const tableClient = new TableClient(
    `https://${accountName}.table.core.windows.net`,
    tableName,
    new AzureSASCredential(sasToken)
  );

  const createTableIfNotExists = async () => {
    try {
      await tableClient.createTable();
    } catch (error) {
      console.error("Error creating table: ", error);
    }
  };
  
  useEffect(() => {
    createTableIfNotExists();
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const entities = tableClient.listEntities({
      queryOptions: {
        filter: `PostType eq 'blog'`,
      },
    });
    const loadedPosts = [];
    for await (const entity of entities) {
      loadedPosts.push(entity);
    }
    setPosts(loadedPosts.sort((a, b) => new Date(b.DatePosted) - new Date(a.DatePosted)));
  };

  const handleCreatePost = async () => {
    const datePosted = new Date().toISOString();
    const newEntity = {
      PartitionKey: "blog",
      RowKey: datePosted,
      Title: newPost.title,
      Text: newPost.text,
      DatePosted: datePosted,
      PostType: "blog",
    };
    await tableClient.createEntity(newEntity);
    setPosts([newEntity, ...posts]);
    setShowPostForm(false);
    setNewPost({ title: "", text: "" });
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ textAlign: "center"}}>Blog</h2>
      <div style={{ textAlign: "left", marginBottom: "10px" }}>
        {isOwner && !showPostForm && (
          <button
            style={{ padding: "10px 15px", marginRight: "20px", cursor: "pointer" }}
            onClick={() => setShowPostForm(true)}
          >
            Create New Post
          </button>
        )}
      </div>
      {showPostForm && isOwner && (
        <div style={{ marginBottom: "20px", padding: "0 20px", textAlign: "left" }}>
            <input
            type="text"
            placeholder="Title"
            value={newPost.title}
            onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
            style={{ width: "60%", padding: "10px", marginBottom: "10px", boxSizing: "border-box" }}
            />
            <textarea
            placeholder="Write your post..."
            value={newPost.text}
            onChange={(e) => setNewPost({ ...newPost, text: e.target.value })}
            style={{ width: "60%", padding: "10px", marginBottom: "10px", boxSizing: "border-box", resize: "vertical" }}
            />
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
        </div>
        )}
      <div>
        {posts.map((post) => (
          <div key={post.RowKey} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
            <h2>{post.Title}</h2>
            <p>{post.Text}</p>
            <p><small>{new Date(post.DatePosted).toLocaleDateString()}</small></p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Blog;