// Initialize default values on page load
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('resize').value = 1024; // Default texture size
    document.getElementById('output-set').value = 'TextureSet1'; // Default texture set name
    updateSliderValue('roughness-slider');
    updateSliderValue('metallic-slider');
});

// Toggle sliders and hide input fields for missing maps
document.getElementById('missing-roughness').addEventListener('change', function() {
    toggleSlider('roughness-slider', this.checked);
    toggleFieldVisibility('roughness', !this.checked);
});

document.getElementById('missing-metallic').addEventListener('change', function() {
    toggleSlider('metallic-slider', this.checked);
    toggleFieldVisibility('metallic', !this.checked);
});

function toggleSlider(sliderId, enabled) {
    const slider = document.getElementById(sliderId);
    slider.disabled = !enabled;
    if (!enabled) {
        slider.value = 0;
        updateSliderValue(sliderId);
    }
}
/*
function toggleFieldVisibility(fieldId, visible) {
    //const field = document.getElementById(fieldId).closest('.mb-3');
    //field.style.display = visible ? 'block' : 'none';
    document.getElementById(fieldId).disabled = !visible;

}
*/
function toggleFieldVisibility(fieldId, visible) {
    const fieldWrapper = document.getElementById(fieldId).closest('.mb-3');
    const input = document.getElementById(fieldId);

    if (visible) {
        fieldWrapper.classList.add('active'); // Enable with animation
        fieldWrapper.classList.remove('disabled');
        //input.disabled = false; // Enable the input
    } else {
        fieldWrapper.classList.remove('active');
        fieldWrapper.classList.add('disabled'); // Grey out with animation
        //input.disabled = true; // Disable the input
    }
}




function updateSliderValue(sliderId) {
    const slider = document.getElementById(sliderId);
    const valueDisplayId = sliderId === 'roughness-slider' ? 'roughness-value' : 'metallic-value';
    const valueDisplay = document.getElementById(valueDisplayId);
    valueDisplay.textContent = parseFloat(slider.value).toFixed(2);

    slider.addEventListener('input', () => {
        valueDisplay.textContent = parseFloat(slider.value).toFixed(2);
    });
}

// Conversion process
document.getElementById('convert-button').addEventListener('click', async function() {
    const downloadButton = document.getElementById('download-button');
    downloadButton.classList.add('d-none'); // Hide download button during conversion

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
        const roughnessImage = roughnessFile ?
            await readImage(roughnessFile) :
            missingRoughness ?
            createSolidImage(roughnessValue) :
            null;
        const metallicImage = metallicFile ?
            await readImage(metallicFile) :
            missingMetallic ?
            createSolidImage(metallicValue) :
            null;

        if (!albedoImage || !normalImage) {
            alert('Albedo and Normal maps are required!');
            return;
        }

        const combinedMetallicImage = combineMetallicAndRoughness(metallicImage, roughnessImage);
        const resizedImages = await resizeImages({ albedoImage, normalImage, combinedMetallicImage },
            outputSetName,
            resizeValue
        );

        const zipFile = await createZip(resizedImages);
        downloadButton.href = URL.createObjectURL(zipFile);
        downloadButton.classList.remove('d-none'); // Show the download button
    } catch (error) {
        console.error('Error during conversion:', error);
        alert('An error occurred during the conversion process.');
    }
});


// Helper function: Read an image from a file input
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

// Helper function: Create a solid image (used for missing roughness/metallic)
function createSolidImage(value) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgba(${value * 255}, ${value * 255}, ${value * 255}, 1)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

// Helper function: Combine metallic and roughness maps into Unity's format
function combineMetallicAndRoughness(metallicImage, roughnessImage) {
    const size = metallicImage.width; // Use the width of the metallic image
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
        combinedData.data[i] = metallicData.data[i]; // Red channel (Metallic)
        combinedData.data[i + 1] = 0; // Green channel
        combinedData.data[i + 2] = 0; // Blue channel
        combinedData.data[i + 3] = 255 - roughnessData.data[i]; // Alpha channel (Inverted Roughness)
    }

    ctx.putImageData(combinedData, 0, 0);
    return canvas;
}


function createCanvasFromImage(image, size) {
    const canvas = document.createElement('canvas');
    canvas.width = size; // Use input size or specified resize value
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, size, size); // Resize image to match output dimensions
    return canvas;
}


// Helper function: Resize images
function resizeImages(images, outputSetName, newSize) {
    return Promise.all(
        Object.entries(images).map(([name, image]) => {
            const canvas = document.createElement('canvas');
            canvas.width = newSize || image.width; // Use original width if no resizing
            canvas.height = newSize || image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

            // Map names to the desired output naming convention
            let outputName = '';
            if (name === 'albedoImage') outputName = `T_${outputSetName}_Albedo`;
            if (name === 'normalImage') outputName = `T_${outputSetName}_Normal`;
            if (name === 'combinedMetallicImage') outputName = `T_${outputSetName}_CombinedMetallic`;

            return canvasToBlob(canvas).then((blob) => ({ name: outputName, blob }));
        })
    );
}




// Helper function: Convert canvas to Blob
function canvasToBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob));
    });
}

// Helper function: Create ZIP file with images
function createZip(images, outputSetName) {
    return new Promise((resolve) => {
        const zip = new JSZip();
        images.forEach(({ name, blob }) => {
            zip.file(`${name}.png`, blob);
        });
        zip.generateAsync({ type: 'blob' }).then(resolve);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const darkModeSwitch = document.getElementById('darkModeSwitch');
    const isDarkMode = localStorage.getItem('theme') === 'dark';

    // Apply saved theme on load
    document.body.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');
    darkModeSwitch.checked = isDarkMode;

    // Toggle theme and save preference
    darkModeSwitch.addEventListener('change', function () {
        const theme = this.checked ? 'dark' : 'light';
        document.body.setAttribute('data-bs-theme', theme);
        localStorage.setItem('theme', theme);
    });
});

