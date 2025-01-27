import { useState, useEffect, useRef, useCallback } from "react";
import { storage, db, uploadBytes, ref, getDownloadURL, collection, addDoc, signInAnonymously, auth, listAll } from "./firebase";

import heic2any from "heic2any";

function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [nextPageToken] = useState(null); // Firebase pagination token
  const galleryRef = useRef(null); // Ref for detecting scroll events

  const fetchImages = useCallback(async () => {
    if (loading) return;
    setLoading(true);
  
    const listRef = ref(storage, "images/");
  
    try {
      const result = await listAll(listRef);
      const imageUrls = await Promise.all(
        result.items.map(async (itemRef) => {
          const url = await getDownloadURL(itemRef);
          return url;
        })
      );
  
      setImages((prevImages) => [...prevImages, ...imageUrls]);
    } catch (error) {
      console.error("Error fetching images:", error.message);
    } finally {
      setLoading(false);
    }
  }, [loading]);

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

  // Fetch initial images
  useEffect(() => {
    if (authLoading || !user) return;

    fetchImages(); // Fetch the first 10 images
  }, [authLoading, user, fetchImages]);
  

  // Infinite scrolling logic
  useEffect(() => {
    const handleScroll = () => {
      if (!galleryRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = galleryRef.current;

      // If close to the bottom of the gallery, fetch more images
      if (scrollTop + clientHeight >= scrollHeight - 300 && nextPageToken) {
        fetchImages();
      }
    };

    const gallery = galleryRef.current;
    if (gallery) {
      gallery.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (gallery) {
        gallery.removeEventListener("scroll", handleScroll);
      }
    };
  }, [nextPageToken, fetchImages]);

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

    // Process files and upload them to Firebase Storage
    const convertedImages = await Promise.all(
      files.map(async (file) => {
        let imageUrl = "";

        if (file.type === "image/heic") {
          const blob = await heic2any({ blob: file, toType: "image/jpeg" });
          const fileRef = ref(storage, `images/${file.name}`);
          await uploadBytes(fileRef, blob);
          imageUrl = await getDownloadURL(fileRef);
        } else {
          const fileRef = ref(storage, `images/${file.name}`);
          await uploadBytes(fileRef, file);
          imageUrl = await getDownloadURL(fileRef);
        }

        // Optionally, save the image URL to Firestore
        await addDoc(collection(db, "images"), {
          url: imageUrl,
          name: file.name,
          timestamp: new Date(),
        });

        return imageUrl;
      })
    );

    setImages((prevImages) => [...prevImages, ...convertedImages]);

    setLoading(false);
  };

  return (
    <div className="App">
      <header>
        <div className="sticky-menu">
          <div className="menu-item left">
            <span className="icon-placeholder">🏠</span> {/* Left button */}
          </div>
          <div className="menu-item large center">
            <span className="icon-placeholder">+</span> {/* Center add button */}
          </div>
          <div className="menu-item right">
            <span className="icon-placeholder">⚙️</span> {/* Right button */}
          </div>
        </div>
        <h1>Freja's Univers</h1>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ marginTop: "1rem" }}
        />
      </header>
      <main ref={galleryRef} style={{ height: "80vh", overflowY: "auto" }}>
        <div className="gallery">
          {images.map((image, index) => (
            <img key={index} src={image} alt={`Uploaded ${index}`} />
          ))}
          {loading && <div className="spinner"></div>}
          {!nextPageToken && !loading && <p>No more images to load.</p>}
        </div>
      </main>
    </div>
  );
}


export default App;
