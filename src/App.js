import { useState } from "react";
import { storage, db, uploadBytes, ref, getDownloadURL, collection, addDoc } from "./firebase";
import heic2any from "heic2any";

function App() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (event) => {
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

        // Optionally, save the image URL to Firestore (optional)
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
        <h1>Freja's Image Gallery</h1>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileUpload}
          style={{ marginTop: "1rem" }}
        />
      </header>
      <main>
        <div className="gallery">
          {loading ? (
            <p>Uploading images...</p>
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
