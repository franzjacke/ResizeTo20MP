
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
    let count = files.length;
    let processedFiles = [];

    for (let i = 0; i < count; i++) {
        const file = files[i];
        document.getElementById('status').innerText = `Currently processing: ${file.name}, remaining: ${count - i - 1}`;
        addLog(`Processing ${file.name}...`);
        const processedFile = await resizeImage(file);
        processedFiles.push(processedFile);
        addLog(`${processedFile.name} processed.`);
    }

    window.processedFiles = processedFiles; // Store processed files globally for access in saveZip
    document.getElementById('saveBtn').disabled = false;
    document.getElementById('downloadLogBtn').disabled = false; // Enable the log download button after processing
}

async function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(img.src);
            const originalWidth = img.width;
            const originalHeight = img.height;
            const totalPixels = originalWidth * originalHeight;

            addLog(`Original dimensions: ${originalWidth} x ${originalHeight}, Total pixels: ${totalPixels}`);

            if (totalPixels > 20000000) {
                addLog('Image exceeds 20 million pixels, resizing will be based on aspect ratio.');

                let newWidth, newHeight;
                if (originalWidth > originalHeight) {
                    newWidth = 5000;
                    newHeight = Math.round((5000 / originalWidth) * originalHeight);
                } else {
                    newHeight = 5000;
                    newWidth = Math.round((5000 / originalHeight) * originalWidth);
                }

                addLog(`Resizing to new dimensions: ${newWidth} x ${newHeight}`);
				

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
                    addLog(`Blob created for ${formattedName}, Blob size: ${blob.size}`);
                    const resizedFile = new File([blob], formattedName, { type: 'image/jpeg', lastModified: Date.now() });
                    resolve(resizedFile);
                }, 'image/jpeg');
            } else {
                addLog(`${file.name} does not require resizing.`);
                resolve(file);
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
