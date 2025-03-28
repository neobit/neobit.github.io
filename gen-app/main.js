import { useState } from "react";

// Categorias fixas
const categories = {
  "Main Prompt": {
    "Artstyle": ["Yumykon", "Fizzeru", "Megrocks"],
    "Media": ["3D", "Blender (medium)", "Anime", "Pixel Art"],
    "Character Count": ["1girl", "1boy", "2girls", "2boys", "1girl and 1boy", "multiple characters", "solo"],
    "Quality tags": ["best quality", "amazing quality", "masterpiece"],
    "Art Style": ["abstract", "as nouveau", "impressionism", "ligne claire", "nihonga", "ukiyo-e", "realistic", "retro artstyle", "painterly", "sketch", "lineart", "no lineart", "jaggy lines", "outline", "vector trace", "color trace", "game cg", "official art", "shikishi", "oekaki", "tegaki"],
    "Color tags": ["anime coloring", "colorful", "dark", "limited palette", "partially colored", "spot color", "monochrome", "greyscale", "muted color", "pale color", "pastel colors", "high contrast"],
    "Post-effects": ["backlighting", "bloom", "bokeh", "chromatic aberration", "depth of field", "diffraction spikes", "dithering", "drop shadow", "emphasis lines", "glitch", "halftone", "lens flare", "motion blur", "soft focus"],
    "Background": ["white background", "linear gradient background", "garden background", "city background", "forest background", "sci fi background", "fog background", "moon background", "mistic background"]
  },
  "Character Prompt": {
    "Camera Framing": ["close-up", "portrait", "upper body", "cowboy shot", "feet out of frame", "full body", "wide shot", "very wide shot"],
    "Camera Angle": ["facing viewer", "from above", "from behind", "from below", "from side", "profile", "sideways", "upside-down", "dutch angle", "multiple views", "zoom layer", "reference sheet"],
    "Character Pose": ["dynamic pose", "standing", "falling", "jumping", "model pose", "suggestive pose", "senal pose", "fighting pose", "cute pose", "happy pose", "v sign pose"],
    "Head clothing": ["baseball cap", "crown", "hair ribbon", "helmet", "beret", "horns", "glasses", "mask"],
    "Neck": ["scarf", "necklace"],
    "Torso Clothing": ["jacket", "dress", "dress shirt", "tank top", "cropped top"],
    "Legwear": ["skirt", "pants", "pelvic curtain", "shorts", "leggings", "pantyhose"],
    "Foot": ["red sneakers", "boots", "slippers"]
  }
};

// Categorias que precisam de campo de texto adicional
const textInputCategories = [
  "Quality tags",        // Main Prompt
  "Head clothing",       // Character Prompt
  "Neck",                // Character Prompt
  "Torso Clothing",      // Character Prompt
  "Legwear",             // Character Prompt
  "Foot",                // Character Prompt
  "Background",          // Main Prompt
  "Character Pose"       // Character Prompt
];

// Exemplo de conversão do nome de tag p/ arquivo em /images
function imagePathFromOption(option) {
  const sanitized = option
    .replace(/\s/g, "_")
    .replace(/[!@#$%^&*(),?\"':{}|<>]/g, "")
    .toLowerCase();

  return `/images/${sanitized}.jpg`;
}

export default function PromptBuilder() {
  const initialSelectedOptions = {
  "Artstyle": ["Yumykon"],
  "Media": ["Pixel Art"],
  "Character Count": ["1girl", "solo"],
  "Quality tags": ["best quality", "amazing quality", "masterpiece"],
  "Color tags": ["colorful"],
  "Background": ["white background"]
};



// Substituímos {} por initialSelectedOptions
const [selectedOptions, setSelectedOptions] = useState(initialSelectedOptions);
  const [textValues, setTextValues] = useState({});
  const [hoveredImage, setHoveredImage] = useState(null);

  // Seleção single / multiple
  const toggleOption = (category, option, singleSelection = false) => {
    setSelectedOptions((prev) => {
      const updated = { ...prev };
      if (!updated[category]) {
        updated[category] = [];
      }

      if (singleSelection) {
        updated[category] = [option];
      } else {
        if (updated[category].includes(option)) {
          updated[category] = updated[category].filter((o) => o !== option);
        } else {
          updated[category].push(option);
        }
      }
      return updated;
    });
  };

  // Limpar seleções
  const clearSelections = () => {
    setSelectedOptions({});
    setTextValues({});
  };

  // Adicionar texto custom
  const addCustomText = (category) => {
    const text = textValues[category]?.trim();
    if (!text) return;

    setSelectedOptions((prev) => {
      const updated = { ...prev };
      if (!updated[category]) {
        updated[category] = [];
      }
      updated[category].push(text);
      return updated;
    });

    setTextValues((prev) => ({ ...prev, [category]: "" }));
  };

  // Gera prompt do Main
  const generateMainPrompt = () => {
    return Object.entries(categories["Main Prompt"]).flatMap(([category, knownOptions]) => {
      let finalOptions = selectedOptions[category] || [];

      // Se for a categoria Artstyle, adiciona " artstyle" ao final
      if (category === "Artstyle") {
        finalOptions = finalOptions.map((opt) => `${opt} artstyle`);
      }

      return finalOptions;
    }).join(", ");
  };

  // Gera prompt do Character
  const generateCharacterPrompt = () => {
    return Object.entries(categories["Character Prompt"]).flatMap(([category, knownOptions]) => {
      return selectedOptions[category] || [];
    }).join(", ");
  };

  // Funções para copiar
  const copyToClipboard = (str) => {
    navigator.clipboard.writeText(str);
    alert("Copiado para a área de transferência!");
  };

  const mainPrompt = generateMainPrompt();
  const charPrompt = generateCharacterPrompt();

  // --- ESTILOS ---
  const containerStyle = {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    height: "100vh",
    backgroundColor: "#0f0f0f",
    color: "white",
    fontFamily: "sans-serif",
  };

  const leftPanelStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "1rem",
    overflowY: "auto",
    boxSizing: "border-box",
  };

  const titleStyle = {
    marginBottom: "1rem",
    fontSize: "1.5rem",
  };

  const clearButtonStyle = {
    padding: "0.6rem 1rem",
    backgroundColor: "#ff4444",
    color: "white",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    marginBottom: "1rem",
  };

  const groupTitleStyle = {
    fontSize: "1.2rem",
    fontWeight: "bold",
    marginBottom: "0.5rem",
  };

  const categoryBoxStyle = {
    backgroundColor: "#1c1c1c",
    marginBottom: "1rem",
    padding: "1rem",
    borderRadius: "8px",
    border: "1px solid #333",
  };

  const categoryTitleStyle = {
    fontWeight: "bold",
    fontSize: "1rem",
    borderBottom: "1px solid #444",
    marginBottom: "0.5rem",
    paddingBottom: "0.3rem",
  };

  const checkboxRowStyle = {
    display: "flex",
    flexWrap: "wrap",
  };

  const checkboxContainerStyle = {
    display: "inline-flex",
    alignItems: "center",
    marginRight: "1rem",
    marginBottom: "0.5rem",
  };

  const textInputStyle = {
    padding: "0.3rem",
    marginRight: "0.5rem",
    borderRadius: "4px",
    border: "1px solid #444",
    backgroundColor: "#111",
    color: "#fff",
  };

  const addButtonStyle = {
    padding: "0.3rem 0.6rem",
    backgroundColor: "#0066cc",
    color: "white",
    borderRadius: "4px",
    cursor: "pointer",
    border: "none",
  };

  const promptBoxContainerStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "1rem",
    marginTop: "1rem",
  };

  const promptBoxStyle = {
    backgroundColor: "#2a2a2a",
    color: "white",
    padding: "1rem",
    borderRadius: "4px",
    whiteSpace: "pre-wrap",
    lineHeight: "1.4",
    position: "relative",
  };

  const copyButtonStyle = {
    position: "absolute",
    right: "1rem",
    bottom: "1rem",
    backgroundColor: "#666",
    color: "white",
    border: "none",
    borderRadius: "4px",
    padding: "0.3rem 0.6rem",
    cursor: "pointer",
    fontSize: "0.8rem",
  };

  const rightPanelStyle = {
    width: "450px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderLeft: "1px solid #333",
    backgroundColor: "#111",
  };

  const previewImageStyle = {
    maxWidth: "90%",
    maxHeight: "90%",
    borderRadius: "8px",
    border: "1px solid #555",
    objectFit: "contain",
  };

  return (
    <div style={containerStyle}>
      <div style={leftPanelStyle}>
        <h1 style={titleStyle}>Prompt Builder</h1>
        <button style={clearButtonStyle} onClick={clearSelections}>
          Clear Selections
        </button>

        {/* Renderização dos grupos: Main Prompt e Character Prompt */}
        {Object.entries(categories).map(([type, sections]) => (
          <div key={type} style={{ marginBottom: "2rem" }}>
            <h2 style={groupTitleStyle}>{type}</h2>

            {Object.entries(sections).map(([category, options]) => {
              const isSingleSelection = ["Artstyle", "Camera Framing", "Camera Angle"].includes(category);

              return (
                <div key={category} style={categoryBoxStyle}>
                  <div style={categoryTitleStyle}>{category}</div>
                  <div style={checkboxRowStyle}>
                    {options.map((option) => {
                      const imgPath = imagePathFromOption(option);
                      return (
                        <div
                          key={option}
                          style={checkboxContainerStyle}
                          onMouseEnter={() => setHoveredImage(imgPath)}
                          onMouseLeave={() => setHoveredImage(null)}
                        >
                          <input
                            type="checkbox"
                            id={option}
                            checked={selectedOptions[category]?.includes(option) || false}
                            onChange={() => toggleOption(category, option, isSingleSelection)}
                          />
                          <label htmlFor={option} style={{ marginLeft: "4px" }}>
                            {option}
                          </label>
                        </div>
                      );
                    })}
                  </div>

                  {/* Se a categoria tiver campo de texto adicional */}
                  {textInputCategories.includes(category) && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <input
                        type="text"
                        style={textInputStyle}
                        placeholder="Digite algo..."
                        value={textValues[category] || ""}
                        onChange={(e) =>
                          setTextValues((prev) => ({
                            ...prev,
                            [category]: e.target.value,
                          }))
                        }
                      />
                      <button
                        style={addButtonStyle}
                        onClick={() => addCustomText(category)}
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Duas áreas separadas para prompts */}
        <div style={promptBoxContainerStyle}>
          {/* Main Prompt Box */}
          <div style={promptBoxStyle}>
            <h3>Main Prompt</h3>
            <div>{mainPrompt}</div>
            <button
              style={copyButtonStyle}
              onClick={() => copyToClipboard(mainPrompt)}
            >
              Copiar
            </button>
          </div>

          {/* Character Prompt Box */}
          <div style={promptBoxStyle}>
            <h3>Character Prompt</h3>
            <div>{charPrompt}</div>
            <button
              style={copyButtonStyle}
              onClick={() => copyToClipboard(charPrompt)}
            >
              Copiar
            </button>
          </div>
        </div>
      </div>

      <div style={rightPanelStyle}>
        {hoveredImage ? (
          <img src={hoveredImage} alt="preview" style={previewImageStyle} />
        ) : (
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <p style={{ color: "#888" }}>Passe o mouse em um item para visualizar</p>
          </div>
        )}
      </div>
    </div>
  );
}
