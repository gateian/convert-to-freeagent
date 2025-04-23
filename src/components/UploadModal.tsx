import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useDropzone, FileWithPath } from "react-dropzone";

// --- Types ---
type BankType = "starling" | "revolut";

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (file: File, bankType: BankType) => void;
  processingError: string | null; // Error from App component processing
}

// --- Dropzone Styling (Redefined here for encapsulation) ---
const DropzoneBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(4),
  textAlign: "center",
  cursor: "pointer",
  backgroundColor: theme.palette.action.hover,
  "&:hover": {
    backgroundColor: theme.palette.action.selected,
  },
  marginTop: theme.spacing(2),
  marginBottom: theme.spacing(2),
}));
// --- End Dropzone Styling ---

const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  onSubmit,
  processingError,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBank, setSelectedBank] = useState<BankType | null>(null);
  const [modalError, setModalError] = useState<string | null>(null); // Internal modal errors

  // Reset state when modal opens or closes effectively
  React.useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setSelectedBank(null);
      setModalError(null);
    }
  }, [open]);

  // --- Dropzone Handler ---
  const onDrop = useCallback((acceptedFiles: FileWithPath[]) => {
    setModalError(null); // Clear previous modal errors
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      // Basic CSV check (can be refined)
      if (
        file.type === "text/csv" ||
        file.name.toLowerCase().endsWith(".csv")
      ) {
        setSelectedFile(file);
        setSelectedBank(null); // Reset bank selection when a new file is dropped
      } else {
        setModalError("Invalid file type. Please upload a CSV file.");
        setSelectedFile(null);
        setSelectedBank(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });
  // --- End Dropzone Handler ---

  // --- Modal Handlers ---
  const handleBankSelection = (
    event: React.MouseEvent<HTMLElement>,
    newBank: BankType | null
  ) => {
    // ToggleButtonGroup passes null when deselecting, but exclusive ensures one is always selected if clicked
    if (newBank !== null) {
      setSelectedBank(newBank);
      setModalError(null); // Clear error when bank is selected
    }
  };

  const handleInternalSubmit = () => {
    if (selectedFile && selectedBank) {
      setModalError(null); // Clear local error
      onSubmit(selectedFile, selectedBank); // Pass data up to App
      // Keep modal open until processing completes or fails in parent
    } else {
      // This case should ideally be prevented by button disable state
      setModalError("Please select a file and a bank type.");
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setSelectedBank(null);
    setModalError(null);
    onClose(); // Call the parent onClose handler
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Bank Statement CSV</DialogTitle>
      <DialogContent>
        {/* Display internal modal errors */}
        {modalError && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {modalError}
          </Alert>
        )}
        {/* Display processing errors from App component */}
        {processingError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {processingError}
          </Alert>
        )}
        <DropzoneBox {...getRootProps()}>
          <input {...getInputProps()} />
          {selectedFile ? (
            <Typography>Selected: {selectedFile.name}</Typography>
          ) : isDragActive ? (
            <Typography>Drop the CSV file here...</Typography>
          ) : (
            <Typography>
              Drag 'n' drop a CSV file here, or click to select file
            </Typography>
          )}
        </DropzoneBox>

        {selectedFile && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 2 }}>
            <ToggleButtonGroup
              color="primary"
              value={selectedBank}
              exclusive
              onChange={handleBankSelection}
              aria-label="Select Bank Type"
            >
              <ToggleButton value="starling">Starling</ToggleButton>
              <ToggleButton value="revolut">Revolut</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleInternalSubmit}
          variant="contained"
          disabled={!selectedFile || !selectedBank} // Disable if no file or bank selected
        >
          Process File
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UploadModal;
