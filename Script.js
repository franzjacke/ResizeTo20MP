
document.addEventListener('DOMContentLoaded', function() {
  // All your event listeners go here

	document.getElementById('saveBtn').addEventListener('click', saveZip);
	document.getElementById('downloadLogBtn').addEventListener('click', downloadLog); // New log button listener

	document.getElementById('fileInput').addEventListener('change', function(event) {
	document.getElementById('processFolderBtn').disabled = event.target.files.length === 0;
	document.getElementById('status').innerText = `Folder loaded: ${event.target.files.length} files`;
	});

	document.getElementById('individualFileInput').addEventListener('change', function(event) {
	document.getElementById('processFilesBtn').disabled = event.target.files.length === 0;
	document.getElementById('status').innerText = `Files loaded: ${event.target.files.length}`;
	});

	document.getElementById('processFolderBtn').addEventListener('click', function() {
		processFiles(document.getElementById('fileInput').files);
	});

	document.getElementById('processFilesBtn').addEventListener('click', function() {
		processFiles(document.getElementById('individualFileInput').files);
	});
    document.getElementById('downloadSingleBtn').addEventListener('click', downloadSingleImage);
    // Add event listener for the new button
document.getElementById('downloadSingleBtn').addEventListener('click', downloadSingleImage);

});

let logMessages = []; // Array to store log messages

function addLog(message) {
    logMessages.push(`${new Date().toISOString()}: ${message}`);
    console.log(message); // Also print the message to the console for real-time feedback
}

function downloadLog() {
    const blob = new Blob(logMessages.map(msg => msg + "\n"), { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'process_log.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function handleFileSelection(event) {
    const files = event.target.files;
    if (files.length > 0) {
        document.getElementById('status').innerText = `Files loaded: ${files.length}`;
        document.getElementById('processBtn').disabled = false;
        addLog(`${files.length} files loaded.`);
    } else {
        document.getElementById('status').innerText = 'No files selected.';
        document.getElementById('processBtn').disabled = true;
    }
}

async function processFiles(files) {
    let promises = [];
    const includeSmaller = document.getElementById('includeSmallerImages').checked;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Skip video files
        if (file.type.startsWith('video/')) {
            addLog(`Skipping ${file.name} as it is a video file.`);
            continue;
        }

        // Process each eligible file in parallel
        promises.push(processSingleFile(file, includeSmaller));
    }

    const processedFiles = await Promise.all(promises);
    const validFiles = processedFiles.filter(file => file !== null);
    window.processedFiles = validFiles; // Store processed files globally for access in saveZip

    updateUIAfterProcessing(validFiles); // Call to centralized UI update function
}


function updateUIAfterProcessing(processedFiles) {
    if (processedFiles.length > 0) {
        document.getElementById('saveBtn').disabled = false;
        document.getElementById('downloadLogBtn').disabled = false;
        document.getElementById('downloadSingleBtn').disabled = processedFiles.length !== 1;
        document.getElementById('status').innerText = "Files ready for zipping.";
    } else {
        document.getElementById('status').innerText = "No files to process.";
        document.getElementById('saveBtn').disabled = true;
        document.getElementById('downloadLogBtn').disabled = true;
        document.getElementById('downloadSingleBtn').disabled = true;
    }
}

// Helper function to process each file
async function processSingleFile(file, includeSmaller) {
    document.getElementById('status').innerText = `Processing: ${file.name}`;
    addLog(`Processing ${file.name}...`);
    const processedFile = await resizeImage(file, includeSmaller);
    if (processedFile) {
        addLog(`${processedFile.name} processed.`);
        return processedFile;
    } else {
        return null;
    }
}

function downloadSingleImage() {
    if (window.processedFiles && window.processedFiles.length === 1) {
        const file = window.processedFiles[0];
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name; // Ensure the correct file name is used
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        addLog(`Downloaded single image: ${file.name}`);
    } else {
        addLog("No single image available or multiple images processed.");
    }
}




async function resizeImage(file, includeSmaller = true) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            const originalWidth = img.width;
            const originalHeight = img.height;
            const totalPixels = originalWidth * originalHeight;

            if (totalPixels > 25000000) {
                const maxPixels = 25000000;
                const scale = Math.sqrt(maxPixels / totalPixels);
                const newWidth = Math.floor(originalWidth * scale);
                const newHeight = Math.floor(originalHeight * scale);

                const canvas = document.createElement('canvas');
                canvas.width = newWidth;
                canvas.height = newHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, newWidth, newHeight);

                canvas.toBlob(blob => {
                    if (!blob) {
                        addLog('Failed to create a valid image blob.');
                        reject(new Error('Failed to create a valid image blob.'));
                        return;
                    }
                    const formattedName = formatFileName(file.name) + '_resized.jpg';
                    const resizedFile = new File([blob], formattedName, { type: 'image/jpeg', lastModified: Date.now() });
                    resolve(resizedFile);
                }, 'image/jpeg');
            } else {
                addLog(`${file.name} does not require resizing.`);
                resolve(includeSmaller ? file : null);
            }
        };
        img.onerror = () => {
            addLog(`Failed to load image ${file.name}`);
            reject(new Error(`Failed to load image ${file.name}`));
        };
    });
}


function formatFileName(filename) {
    return filename.substring(0, filename.lastIndexOf('.')) || filename;
}


function formatFileName(fileName) {
    // Clean up file names by replacing spaces and removing special characters
    return fileName.replace(/\s+/g, '_').replace(/\(|\)/g, '');
}

async function saveZip() {
    const zip = new JSZip();
    const files = window.processedFiles;
    const statusElement = document.getElementById('status');
    const loaderElement = document.getElementById('loading');

    loaderElement.style.display = 'block'; // Show the loader
    statusElement.innerText = "Processing...";

    addLog("Starting to zip files...");

    // Process each file and update the status text
    for (const file of files) {
        addLog(`Processing ${file.name}...`);
        zip.file(file.name, file); // Add file to zip
        addLog(`Added ${file.name} to zip.`);
    }

    // Finalize the zip
    addLog("All files added to zip. Generating zip file...");
    zip.generateAsync({ type: 'blob' })
        .then(function(content) {
            loaderElement.style.display = 'none'; // Hide the loader
            statusElement.innerText = "Zipping complete. Zip file is ready to download.";
            addLog("Zipping complete. Zip file is ready to download.");
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'resized_images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            addLog('Zip file has been created and downloaded.');
            document.getElementById('saveBtn').disabled = true;
        })
        .catch(error => {
            loaderElement.style.display = 'none';
            const errorMsg = `Error zipping files: ${error.message}`;
            statusElement.innerText = errorMsg;
            addLog(errorMsg);
        });
}
