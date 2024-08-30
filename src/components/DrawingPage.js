import React, { useState, useEffect, useRef } from "react";
import { BlobServiceClient } from "@azure/storage-blob";
import "./DrawingPage.css";

const DrawingPage = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedColor, setSelectedColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);
  const [context, setContext] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const accountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const sasToken = process.env.REACT_APP_AZURE_STORAGE_SAS_TOKEN;
  const containerName = "drawingdata";
  const blobName = "drawing.png";

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net?${sasToken}`
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // User roles (should be fetched from your authentication logic)
  const userRoles = ["WifeRole", "OwnerRole"];
  const canResetCanvas = userRoles.includes("OwnerRole") || userRoles.includes("WifeRole");

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    setContext(ctx);

    const initializeCanvas = async () => {
      try {
        const containerExists = await containerClient.exists();
        if (!containerExists) {
          await containerClient.create();
          console.log("Container created successfully.");

          // Initialize with a blank canvas
          ctx.fillStyle = "#FFFFFF"; // White background
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Convert canvas to a blob and upload it as the initial blank canvas
          canvas.toBlob(async (blob) => {
            await blockBlobClient.upload(blob, blob.size, {
              blobHTTPHeaders: { blobContentType: "image/png" },
            });
          });
        } else {
          // Load existing drawing from the blob storage on page load
          const loadDrawing = async () => {
            try {
              const downloadBlockBlobResponse = await blockBlobClient.download();
              const imageUrl = URL.createObjectURL(await downloadBlockBlobResponse.blobBody);
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
              };
              img.src = imageUrl;
            } catch (error) {
              console.error("Error loading drawing:", error);
            }
          };

          loadDrawing();

          // Reload canvas every 5 seconds unless the user is drawing
          const reloadInterval = setInterval(() => {
            if (!isDrawing) {
              loadDrawing();
            }
          }, 5000);

          return () => clearInterval(reloadInterval); // Clear the interval on component unmount
        }
      } catch (error) {
        console.error("Error initializing canvas:", error);
      }
    };

    initializeCanvas();
  }, [containerClient, blockBlobClient, isDrawing]);

  const startDrawing = (e) => {
    context.strokeStyle = selectedColor;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    context.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    context.stroke();
    setHasChanges(true);
  };

  const stopDrawing = async () => {
    context.closePath();
    setIsDrawing(false);

    // Save the drawing to the Azure Blob Storage on mouse release only if there are changes
    if (hasChanges) {
      try {
        canvasRef.current.toBlob(async (blob) => {
          await blockBlobClient.upload(blob, blob.size, {
            blobHTTPHeaders: { blobContentType: "image/png" },
          });
        });
        setHasChanges(false);
      } catch (error) {
        console.error("Error saving drawing:", error);
      }
    }
  };

  const resetCanvas = async () => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.fillStyle = "#FFFFFF"; // Reset to white background
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Save the blank canvas to Azure Blob Storage
    canvasRef.current.toBlob(async (blob) => {
      await blockBlobClient.upload(blob, blob.size, {
        blobHTTPHeaders: { blobContentType: "image/png" },
      });
    });
  };

  return (
    <div className="drawing-page">
      <div className="palette">
        <div className="color-options">
          {["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#C0C0C0", "#808080"].map((color) => (
            <div
              key={color}
              className="color-swatch"
              style={{ backgroundColor: color, border: "1px solid #FFFFFF" }}
              onClick={() => setSelectedColor(color)}
            ></div>
          ))}
        </div>
        <div className="selected-color" style={{ backgroundColor: selectedColor }}></div>
      </div>
      <div className="line-width-selector">
        <label htmlFor="line-width">Line Width: </label>
        <select id="line-width" value={lineWidth} onChange={(e) => setLineWidth(e.target.value)}>
          {[2, 5, 10, 15, 20].map((size) => (
            <option key={size} value={size}>{size}px</option>
          ))}
        </select>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
      ></canvas>
      {canResetCanvas && (
        <button className="reset-button" onClick={resetCanvas}>Reset Canvas</button>
      )}
    </div>
  );
};

export default DrawingPage;
