import { useState, useEffect } from "react";
import {
  storage,
  db,
  uploadBytes,
  ref,
  getDownloadURL,
  collection,
  addDoc,
  signInAnonymously,
  auth,
  listAll,
} from "./firebase";
import heic2any from "heic2any";
import EXIF from "exif-js"; // Import the exif-js library

function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // New loading state for authentication
  const [user, setUser] = useState(null);
  const [overlayVisible, setOverlayVisible] = useState(false); // New state for overlay visibility

  // Authentication logic
  useEffect(() => {
    signInAnonymously(auth)
      .then((userCredential) => {
        setUser(userCredential.user);
        console.log("Signed in as", userCredential.user.uid);
      })
      .catch((error) => {
        console.error("Error signing in:", error.message);
      })
      .finally(() => {
        setAuthLoading(false); // Set authentication loading to false after auth completes
      });
  }, []);

  // Fetch images from Firebase Storage
  useEffect(() => {
    if (authLoading || !user) return;
  
    const fetchImages = async () => {
      const listRef = ref(storage, "images/");
      const result = await listAll(listRef); // List all images in the 'images/' folder
  
      const datePattern = /^\d{8}_/; // Regex to match filenames starting with YYYYMMDD_
  
      const imageUrls = await Promise.all(
        result.items
          .filter((itemRef) => datePattern.test(itemRef.name)) // Filter images with valid dates in the name
          .map(async (itemRef) => {
            const url = await getDownloadURL(itemRef); // Fetch download URL for each image
            return { url, name: itemRef.name }; // Return both URL and name
          })
      );
  
      // Sort images by date in descending order (newest first)
      const sortedImages = imageUrls.sort((a, b) => {
        const dateA = a.name.match(datePattern)[0]; // Extract the date part (YYYYMMDD)
        const dateB = b.name.match(datePattern)[0];
        return dateB.localeCompare(dateA); // Compare dates in descending order
      });
  
      setImages(sortedImages.map((img) => img.url)); // Extract only URLs for rendering
    };
  
    fetchImages();
  }, [authLoading, user]);

  const handleFileUpload = async (event) => {
    if (authLoading) {
      console.log("Authentication is still in progress...");
      return;
    }

    if (!user) {
      console.log("User is not authenticated.");
      return;
    }

    const files = Array.from(event.target.files);
    setLoading(true);
    setOverlayVisible(true); // Show overlay and spinner

    try {
      // Process files and upload them to Firebase Storage
      await Promise.all(
        files.map(async (file) => {
          let fileName = file.name;

          // Extract date from EXIF or file metadata
          const dateTaken = await new Promise((resolve) => {
            if (file.type === "image/png") {
              resolve(null); // PNG files don't have EXIF data
            } else {
              const reader = new FileReader();
              reader.onload = function () {
                EXIF.getData(file, function () {
                  const exifDate = EXIF.getTag(this, "DateTimeOriginal");
                  resolve(exifDate || null);
                });
              };
              reader.readAsArrayBuffer(file);
            }
          });

          // Use EXIF date, file's last modified date, or today's date
          let formattedDate;
          if (dateTaken) {
            formattedDate = dateTaken.replace(/:/g, "").split(" ")[0]; // Convert "YYYY:MM:DD HH:MM:SS" to "YYYYMMDD"
          } else if (file.lastModified) {
            const modifiedDate = new Date(file.lastModified);
            formattedDate = modifiedDate
              .toISOString()
              .split("T")[0]
              .replace(/-/g, ""); // Format as "YYYYMMDD"
          } else {
            const today = new Date();
            formattedDate = today
              .toISOString()
              .split("T")[0]
              .replace(/-/g, ""); // Format today's date as "YYYYMMDD"
          }

          // Prepend date to file name
          const extension = fileName.substring(fileName.lastIndexOf("."));
          fileName = `${formattedDate}_${fileName.replace(extension, "")}${extension}`;

          let uploadedFileUrl = "";

          // Handle HEIC files using heic2any
          if (file.type === "image/heic") {
            const blob = await heic2any({ blob: file, toType: "image/jpeg" });
            const fileRef = ref(storage, `images/${fileName}`);
            await uploadBytes(fileRef, blob);
            uploadedFileUrl = await getDownloadURL(fileRef);
          } else {
            // Handle non-HEIC files
            const fileRef = ref(storage, `images/${fileName}`);
            await uploadBytes(fileRef, file);
            uploadedFileUrl = await getDownloadURL(fileRef);
          }

          // Optionally, save the image URL to Firestore
          await addDoc(collection(db, "images"), {
            url: uploadedFileUrl,
            name: fileName,
            timestamp: new Date(),
          });

          // Return image URL for display purposes
          return uploadedFileUrl;
        })
      );

      // After all files are uploaded and URLs are fetched, show overlay for 5 seconds, then refresh the page
      setTimeout(() => {
        setOverlayVisible(false); // Hide overlay after 5 seconds
        setLoading(false);
        window.location.reload(); // Refresh the page
      }, 5000);

    } catch (error) {
      console.error("Error during file upload:", error);
      setLoading(false);
      setOverlayVisible(false); // Hide overlay if there is an error
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Freja's Univers</h1>
        <div className="btn-container">
          <label htmlFor="files" className="btn">
            🖼️
          </label>
          <input
            id="files"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            style={{ display: "none" }}
          />
        </div>
      </header>
      <main>
        <div className="gallery">
          {loading ? (
            <div className="spinner"></div>
          ) : images.length > 0 ? (
            images.map((image, index) => (
              <img key={index} src={image} alt={`Uploaded ${index}`} />
            ))
          ) : (
            <p>No images uploaded yet!</p>
          )}
        </div>
      </main>

      {/* Overlay and Spinner */}
      {overlayVisible && (
        <div className="overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
}

export default App;
