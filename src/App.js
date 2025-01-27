import { useState, useEffect } from "react";
import { storage, db, uploadBytes, ref, getDownloadURL, collection, addDoc, signInAnonymously, auth, listAll } from "./firebase";
import heic2any from "heic2any";

function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true); // New loading state for authentication
  const [user, setUser] = useState(null);

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
      const listRef = ref(storage, 'images/');
      const result = await listAll(listRef);  // List all images in the 'images/' folder
      const imageUrls = await Promise.all(result.items.map(async (itemRef) => {
        const url = await getDownloadURL(itemRef);  // Fetch download URL for each image
        return url;
      }));
      setImages(imageUrls);
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

    // Show loading spinner for 5 seconds before refreshing
    setTimeout(() => {
      setLoading(false);  // Stop loading spinner
      window.location.reload();  // Refresh the page
    }, 5000);
  };

  return (
    <div className="App">
      <header>

        <h1>Freja's Univers</h1>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ marginTop: "1rem" }}
        />
      </header>
      <main>
      <div className="rocket-container">
  <div className="rocket left"></div>
  <div className="rocket right"></div>
</div>
        <div className="gallery">
          {loading ? (
            <div className="spinner"></div> // Show spinner when uploading
          ) : images.length > 0 ? (
            images.map((image, index) => (
              <img key={index} src={image} alt={`Uploaded ${index}`} />
            ))
          ) : (
            <p>No images uploaded yet!</p>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
