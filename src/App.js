import { useState } from "react";
import heic2any from "heic2any";

function App() {
  const [images, setImages] = useState([]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const convertedImages = await Promise.all(
      files.map(async (file) => {
        if (file.type === "image/heic") {
          const blob = await heic2any({ blob: file, toType: "image/jpeg" });
          return URL.createObjectURL(blob);
        }
        return URL.createObjectURL(file);
      })
    );
    setImages((prevImages) => [...prevImages, ...convertedImages]);
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
          {images.length > 0 ? (
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
