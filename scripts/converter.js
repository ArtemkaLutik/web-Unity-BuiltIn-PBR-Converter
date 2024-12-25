// Initialize default values and set up event listeners
// Ensures all input fields and sliders start with proper default values

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('resize').value = 1024; // Default texture size
    document.getElementById('output-set').value = 'TextureSet1'; // Default texture set name
    updateSliderValue('roughness-slider');
    updateSliderValue('metallic-slider');
});

// Toggle visibility and enable/disable sliders for missing roughness and metallic maps
document.getElementById('missing-roughness').addEventListener('change', function() {
    toggleSlider('roughness-slider', this.checked);
    toggleFieldVisibility('roughness', !this.checked);
});

document.getElementById('missing-metallic').addEventListener('change', function() {
    toggleSlider('metallic-slider', this.checked);
    toggleFieldVisibility('metallic', !this.checked);
});

// Toggles the slider's enabled state and resets its value if disabled
function toggleSlider(sliderId, enabled) {
    const slider = document.getElementById(sliderId);
    slider.disabled = !enabled;
    if (!enabled) {
        slider.value = 0;
        updateSliderValue(sliderId);
    }
}

// Shows or hides input fields based on visibility settings
function toggleFieldVisibility(fieldId, visible) {
    const fieldWrapper = document.getElementById(fieldId).closest('.mb-3');
    if (visible) {
        fieldWrapper.classList.remove('disabled');
    } else {
        fieldWrapper.classList.add('disabled');
    }
}

// Updates the display value of the sliders dynamically
function updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueDisplayId = sliderId === 'roughness-slider' ? 'roughness-value' : 'metallic-value';
    const valueDisplay = document.getElementById(valueDisplayId);
    valueDisplay.textContent = parseFloat(slider.value).toFixed(2);

    slider.addEventListener('input', () => {
        valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
    });
}

// Handles the texture conversion process, including reading inputs and generating outputs
document.getElementById('convert-button').addEventListener('click', async function() {
    const downloadButton = document.getElementById('download-button');
    downloadButton.classList.add('d-none');

    const albedoFile = document.getElementById('albedo').files[0];
    const normalFile = document.getElementById('normal').files[0];
    const roughnessFile = document.getElementById('roughness').files[0];
    const metallicFile = document.getElementById('metallic').files[0];

    const missingRoughness = document.getElementById('missing-roughness').checked;
    const missingMetallic = document.getElementById('missing-metallic').checked;

    const roughnessValue = parseFloat(document.getElementById('roughness-slider').value);
    const metallicValue = parseFloat(document.getElementById('metallic-slider').value);
    const resizeValue = parseInt(document.getElementById('resize').value, 10) || 1024;
    const outputSetName = document.getElementById('output-set').value || 'TextureSet1';

    try {
        const albedoImage = albedoFile ? await readImage(albedoFile) : null;
        const normalImage = normalFile ? await readImage(normalFile) : null;

        const roughnessImage = roughnessFile ? await readImage(roughnessFile) : missingRoughness ? createSolidImage(roughnessValue) : null;
        const metallicImage = metallicFile ? await readImage(metallicFile) : missingMetallic ? createSolidImage(metallicValue) : null;

        if (!albedoImage || !normalImage) {
            alert('Albedo and Normal maps are required!');
            return;
        }

        const combinedMetallicImage = combineMetallicAndRoughness(metallicImage, roughnessImage);
        const resizedImages = await resizeImages({ albedoImage, normalImage, combinedMetallicImage }, outputSetName, resizeValue);

        const zipFile = await createZip(resizedImages);
        downloadButton.href = URL.createObjectURL(zipFile);
        downloadButton.classList.remove('d-none');
    } catch (error) {
        console.error('Error during conversion:', error);
        alert('An error occurred during the conversion process.');
    }
});

// Reads and returns an image from a file input
function readImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

// Creates a solid-color image for missing maps
function createSolidImage(value) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgba(${value * 255}, ${value * 255}, ${value * 255}, 1)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

// Combines metallic and roughness maps into Unity's required format
function combineMetallicAndRoughness(metallicImage, roughnessImage) {
    const size = metallicImage.width;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const metallicCanvas = createCanvasFromImage(metallicImage, size);
    const roughnessCanvas = createCanvasFromImage(roughnessImage, size);

    const metallicData = metallicCanvas.getContext('2d').getImageData(0, 0, size, size);
    const roughnessData = roughnessCanvas.getContext('2d').getImageData(0, 0, size, size);

    const combinedData = ctx.createImageData(size, size);
    for (let i = 0; i < combinedData.data.length; i += 4) {
        combinedData.data[i] = metallicData.data[i]; // Red channel
        combinedData.data[i + 1] = 0; // Green channel
        combinedData.data[i + 2] = 0; // Blue channel
        combinedData.data[i + 3] = 255 - roughnessData.data[i]; // Alpha channel
    }

    ctx.putImageData(combinedData, 0, 0);
    return canvas;
}

// Creates a canvas element from an image and resizes it
function createCanvasFromImage(image, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, size, size);
    return canvas;
}

// Resizes images to the desired dimensions
function resizeImages(images, outputSetName, newSize) {
    return Promise.all(
        Object.entries(images).map(([name, image]) => {
            const canvas = document.createElement('canvas');
            canvas.width = newSize || image.width;
            canvas.height = newSize || image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            let outputName = '';
            if (name === 'albedoImage') outputName = `T_${outputSetName}_Albedo`;
            if (name === 'normalImage') outputName = `T_${outputSetName}_Normal`;
            if (name === 'combinedMetallicImage') outputName = `T_${outputSetName}_CombinedMetallic`;

            return canvasToBlob(canvas).then((blob) => ({ name: outputName, blob }));
        })
    );
}

// Converts a canvas to a Blob object
function canvasToBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob));
    });
}

// Creates a ZIP file containing all processed images
function createZip(images) {
    return new Promise((resolve) => {
        const zip = new JSZip();
        images.forEach(({ name, blob }) => {
            zip.file(`${name}.png`, blob);
        });
        zip.generateAsync({ type: 'blob' }).then(resolve);
    });
}