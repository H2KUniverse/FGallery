import { useState, useEffect, useRef } from "react";
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
import EXIF from "exif-js";

function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const galleryRef = useRef(null);  // To keep reference of gallery container

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
        setAuthLoading(false);
      });
  }, []);

  // Fetch images from Firebase Storage
  useEffect(() => {
    if (authLoading || !user) return;

    const fetchImages = async () => {
      const listRef = ref(storage, "images/");
      const result = await listAll(listRef);
      const datePattern = /^\d{8}_/;

      const imageUrls = await Promise.all(
        result.items
          .filter((itemRef) => datePattern.test(itemRef.name))
          .map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return { url, name: itemRef.name };
          })
      );

      // Sort by date, newest first
      const sortedImages = imageUrls.sort((a, b) => {
        const dateA = a.name.match(datePattern)[0];
        const dateB = b.name.match(datePattern)[0];
        return dateB.localeCompare(dateA); // Newest first
      });

      setImages(sortedImages);
    };

    fetchImages();
  }, [authLoading, user]);

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    setLoading(true);

    try {
      await Promise.all(
        files.map(async (file) => {
          let fileName = file.name;

          // Extract date from EXIF or file metadata
          const dateTaken = await new Promise((resolve) => {
            if (file.type === "image/png") {
              resolve(null);
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

          let formattedDate;
          if (dateTaken) {
            formattedDate = dateTaken.replace(/:/g, "").split(" ")[0];
          } else if (file.lastModified) {
            const modifiedDate = new Date(file.lastModified);
            formattedDate = modifiedDate
              .toISOString()
              .split("T")[0]
              .replace(/-/g, "");
          } else {
            const today = new Date();
            formattedDate = today
              .toISOString()
              .split("T")[0]
              .replace(/-/g, "");
          }

          fileName = `${formattedDate}_${fileName}`;

          let uploadedFileUrl = "";

          if (file.type === "image/heic") {
            const blob = await heic2any({ blob: file, toType: "image/jpeg" });
            const fileRef = ref(storage, `images/${fileName}`);
            await uploadBytes(fileRef, blob);
            uploadedFileUrl = await getDownloadURL(fileRef);
          } else {
            const fileRef = ref(storage, `images/${fileName}`);
            await uploadBytes(fileRef, file);
            uploadedFileUrl = await getDownloadURL(fileRef);
          }

          await addDoc(collection(db, "images"), {
            url: uploadedFileUrl,
            name: fileName,
            timestamp: new Date(),
          });

          return uploadedFileUrl;
        })
      );

      setTimeout(() => {
        setLoading(false);
        window.location.reload(); 
      }, 5000);

    } catch (error) {
      console.error("Error during file upload:", error);
      setLoading(false);
    }
  };

  const handleThumbnailClick = (index) => {
    setSelectedImageIndex(index);
  };

  // Handle swipe (up/down) on the gallery
  const handleSwipe = (event) => {
    const container = galleryRef.current;

    // Detect swipe direction and update selectedImageIndex
    if (event.deltaY > 0) {
      // Scrolling down
      setSelectedImageIndex((prev) => Math.min(prev + 1, images.length - 1)); 
    } else {
      // Scrolling up
      setSelectedImageIndex((prev) => Math.max(prev - 1, 0)); 
    }
  };

  useEffect(() => {
    if (galleryRef.current) {
      galleryRef.current.addEventListener("wheel", handleSwipe, { passive: true });
    }

    return () => {
      if (galleryRef.current) {
        galleryRef.current.removeEventListener("wheel", handleSwipe);
      }
    };
  }, [images.length]);

  return (
    <div className="App">
      <header>
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
        <div
          className="gallery"
          ref={galleryRef}
          style={{
            overflowY: "auto", // Ensures vertical scrolling
            height: "90vh", // Takes up most of the screen height
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {loading ? (
            <div className="spinner"></div>
          ) : images.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {images.map((image, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: "10px",
                    cursor: "pointer",
                    border: selectedImageIndex === index ? "2px solid #00f" : "none",
                  }}
                  onClick={() => handleThumbnailClick(index)}
                >
                  <img
                    src={image.url}
                    alt={`Uploaded ${index}`}
                    style={{
                      width: "100%",
                      height: "auto",
                      maxHeight: "500px", // Limit the max height for images
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p>No images uploaded yet!</p>
          )}
        </div>
      </main>

      <div className="timeline-container">
        <div
          className="timeline-thumbnails"
          style={{
            display: "flex",
            overflowX: "auto",
            whiteSpace: "nowrap",
            padding: "10px",
          }}
        >
          {images.map((image, index) => (
            <img
              key={index}
              src={image.url}
              alt={`Thumbnail ${index}`}
              className={`timeline-thumbnail ${selectedImageIndex === index ? "selected" : ""}`}
              data-index={index}
              onClick={() => handleThumbnailClick(index)}
              style={{
                cursor: "pointer",
                width: "60px",
                height: "60px",
                margin: "5px",
                objectFit: "cover",
                border: selectedImageIndex === index ? "2px solid #00f" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
