import React, { useState, useEffect, useMemo } from "react";
import { useMsal } from "@azure/msal-react";
import { TableClient, AzureSASCredential } from "@azure/data-tables";

const Journal = () => {
  const { accounts } = useMsal();
  const account = accounts[0];
  const roles = account?.idTokenClaims.roles || [];
  const isOwner = roles.includes("OwnerRole");

  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState({ title: "", text: "" });
  const [showPostForm, setShowPostForm] = useState(false);

  const accountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN;

  const tableClient = useMemo(() => {
    return new TableClient(
      `https://${accountName}.table.core.windows.net`,
      "Posts",
      new AzureSASCredential(sasToken)
    );
  }, [accountName, sasToken]);

  useEffect(() => {
    if (isOwner) {
      const checkAndCreateTable = async () => {
        try {
          // Check if the table exists by listing entities (this throws an error if the table doesn't exist)
          await tableClient.listEntities().next();
        } catch (error) {
          if (error.statusCode === 404) {
            // If the table doesn't exist, create it
            try {
              await tableClient.createTable();
              console.log("Table created successfully.");
            } catch (creationError) {
              console.error("Error creating table: ", creationError);
            }
          } else {
            console.error("Error checking table existence: ", error);
          }
        }
      };

      const loadPosts = async () => {
        try {
          const entities = tableClient.listEntities({
            queryOptions: {
              filter: `PostType eq 'journal'`,
            },
          });
          const loadedPosts = [];
          for await (const entity of entities) {
            loadedPosts.push(entity);
          }
          setPosts(loadedPosts.sort((a, b) => new Date(b.DatePosted) - new Date(a.DatePosted)));
        } catch (error) {
          console.error("Error loading posts: ", error);
        }
      };

      checkAndCreateTable();
      loadPosts();
    }
  }, [isOwner, tableClient]);

  const handleCreatePost = async () => {
    const datePosted = new Date().toISOString();
    const newEntity = {
      PartitionKey: "journal",
      RowKey: datePosted,
      Title: newPost.title,
      Text: newPost.text,
      DatePosted: datePosted,
      PostType: "journal",
    };
    try {
      await tableClient.createEntity(newEntity);
      setPosts([newEntity, ...posts]); // Update the state with the new post
      setShowPostForm(false);
      setNewPost({ title: "", text: "" });
    } catch (error) {
      console.error("Error creating post: ", error);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ textAlign: "center" }}>Journal</h2>
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
      {isOwner && showPostForm && (
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
      {isOwner && (
        <div>
          {posts.map((post) => (
            <div key={post.RowKey} style={{ marginBottom: "20px", borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>
              <h2>{post.Title}</h2>
              <p>{post.Text}</p>
              <p><small>{new Date(post.DatePosted).toLocaleDateString()}</small></p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Journal;
