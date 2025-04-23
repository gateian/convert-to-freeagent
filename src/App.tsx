import React, { useState, useCallback } from "react";
import {
  Container,
  Typography,
  Button,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  Alert,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: "100%",
  display: "flex",
  flexDirection: "column",
}));

const TableWrapper = styled(Box)({
  flexGrow: 1,
  overflow: "auto",
  marginTop: "16px",
});

// --- Dropzone Styling ---
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

interface Transaction {
  [key: string]: string;
}

interface FreeAgentTransaction {
  Date: string;
  Amount: string;
  Description: string;
}

interface StarlingTransaction extends Transaction {
  Date: string;
  "Counter Party": string;
  Reference: string;
  Type: string;
  "Amount (GBP)": string;
  "Balance (GBP)": string;
  "Spending Category": string;
  Notes: string;
}

// --- Revolut Transaction Interface ---
interface RevolutTransaction extends Transaction {
  Type: string;
  Product: string;
  "Started Date": string;
  "Completed Date": string;
  Description: string;
  Amount: string; // It comes as string from PapaParse
  Fee: string;
  Currency: string;
  State: string;
  Balance: string;
}
// --- End Revolut Transaction Interface ---

function App() {
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const [originalTransactions, setOriginalTransactions] = useState<
    Transaction[]
  >([]);
  const [formattedTransactions, setFormattedTransactions] = useState<
    FreeAgentTransaction[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBank, setSelectedBank] = useState<
    "starling" | "revolut" | null
  >(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSelectedFile(file);
        setOriginalFileName(file.name);
        setError(null);
        setOriginalTransactions([]);
        setFormattedTransactions([]);
        setSelectedBank(null);
      } else {
        setError("Invalid file type. Please upload a CSV file.");
        setSelectedFile(null);
        setOriginalFileName("");
        setSelectedBank(null);
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    multiple: false,
  });

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setSelectedFile(null);
    setSelectedBank(null);
    setError(null);
    setOriginalFileName("");
    setOriginalTransactions([]);
    setFormattedTransactions([]);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleBankSelection = (
    event: React.MouseEvent<HTMLElement>,
    newBank: "starling" | "revolut" | null
  ) => {
    if (newBank !== null) {
      setSelectedBank(newBank);
    }
  };

  const handleProcessUpload = () => {
    if (!selectedFile || !selectedBank) {
      setError("Please select a file and a bank type.");
      return;
    }

    setError(null);

    Papa.parse<Transaction>(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.error("Parsing errors:", results.errors);
          setError(
            `Error parsing CSV: ${results.errors
              .map((e) => e.message)
              .join(", ")}`
          );
          setOriginalTransactions([]);
          setFormattedTransactions([]);
          return;
        }
        if (!results.data || results.data.length === 0) {
          setError("CSV file is empty or invalid.");
          setOriginalTransactions([]);
          setFormattedTransactions([]);
          return;
        }

        setOriginalTransactions(results.data);

        let converted: FreeAgentTransaction[] | string;
        if (selectedBank === "starling") {
          converted = convertStarlingToFreeAgent(results.data);
        } else if (selectedBank === "revolut") {
          converted = convertRevolutToFreeAgent(results.data);
        } else {
          setError("No bank type selected.");
          setFormattedTransactions([]);
          return;
        }

        if (typeof converted === "string") {
          setError(converted);
          setFormattedTransactions([]);
        } else {
          setFormattedTransactions(converted);
          setError(null);
          handleCloseModal();
        }
      },
      error: (err) => {
        console.error("PapaParse error:", err);
        setError(`Error reading file: ${err.message}`);
        setOriginalTransactions([]);
        setFormattedTransactions([]);
      },
    });
  };

  const convertStarlingToFreeAgent = (
    data: Transaction[]
  ): FreeAgentTransaction[] | string => {
    try {
      if (data.length > 0) {
        const firstRowKeys = Object.keys(data[0]);
        if (!firstRowKeys.includes("Amount (GBP)")) {
          throw new Error(
            `Missing required Starling column header: "Amount (GBP)". Found headers: ${firstRowKeys.join(
              ", "
            )}`
          );
        }
        if (!firstRowKeys.includes("Counter Party")) {
          throw new Error(
            `Missing required Starling column header: "Counter Party". Found headers: ${firstRowKeys.join(
              ", "
            )}`
          );
        }
        if (!firstRowKeys.includes("Date")) {
          throw new Error(
            `Missing required Starling column header: "Date". Found headers: ${firstRowKeys.join(
              ", "
            )}`
          );
        }
      } else {
        return [];
      }

      return data.map((rowUntyped, index) => {
        const row = rowUntyped as StarlingTransaction;
        const rowIndex = index + 2;

        if (!row.Date) {
          throw new Error(`Missing 'Date' in row ${rowIndex}`);
        }
        if (row["Amount (GBP)"] === undefined || row["Amount (GBP)"] === null) {
          throw new Error(`Missing 'Amount (GBP)' in row ${rowIndex}`);
        }
        const counterParty = row["Counter Party"] || "";

        const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!datePattern.test(row.Date)) {
          throw new Error(
            `Invalid date format in row ${rowIndex}: "${row.Date}". Expected dd/mm/yyyy.`
          );
        }
        const formattedDate = row.Date;

        const amount = parseFloat(row["Amount (GBP)"]);
        if (isNaN(amount)) {
          throw new Error(
            `Invalid 'Amount (GBP)' in row ${rowIndex}: "${row["Amount (GBP)"]}". Not a valid number.`
          );
        }
        const formattedAmount = amount.toFixed(2);

        let description = counterParty;
        if (row.Reference) {
          description += ` - ${row.Reference}`;
        }
        description = description.replace(/,/g, "").replace(/"/g, "");
        description = description.replace(/\r\n|\n|\r/gm, " ").trim();

        return {
          Date: formattedDate,
          Amount: formattedAmount,
          Description: description,
        };
      });
    } catch (e: any) {
      console.error("Starling Conversion Error:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return `Error during Starling conversion: ${errorMessage}`;
    }
  };

  const convertRevolutToFreeAgent = (
    data: Transaction[]
  ): FreeAgentTransaction[] | string => {
    try {
      // Check if the first row has the required Revolut columns
      if (data.length > 0) {
        const firstRowKeys = Object.keys(data[0]);
        const requiredHeaders = ["Completed Date", "Amount", "Description"];
        for (const header of requiredHeaders) {
          if (!firstRowKeys.includes(header)) {
            throw new Error(
              `Missing required Revolut column header: "${header}". Found headers: ${firstRowKeys.join(
                ", "
              )}`
            );
          }
        }
      } else {
        return []; // Return empty if no data
      }

      return data.map((rowUntyped, index) => {
        const row = rowUntyped as RevolutTransaction; // Treat row as RevolutTransaction
        const rowIndex = index + 2; // +1 for 0-based index, +1 for header row

        // --- Validation ---
        if (!row["Completed Date"]) {
          throw new Error(`Missing 'Completed Date' in row ${rowIndex}`);
        }
        if (row.Amount === undefined || row.Amount === null) {
          throw new Error(`Missing 'Amount' in row ${rowIndex}`);
        }
        // Description can be empty, default to empty string
        const descriptionRaw = row.Description || "";

        // --- Date Formatting ---
        // Revolut format seems to be 'YYYY-MM-DD HH:MM:SS'
        const dateString = row["Completed Date"].split(" ")[0]; // Get the YYYY-MM-DD part
        const dateParts = dateString.split("-");
        if (
          dateParts.length !== 3 ||
          dateParts[0].length !== 4 || // YYYY
          dateParts[1].length !== 2 || // MM
          dateParts[2].length !== 2 // DD
        ) {
          throw new Error(
            `Invalid date format in row ${rowIndex}: "${row["Completed Date"]}". Expected YYYY-MM-DD.`
          );
        }
        const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`; // Convert to dd/mm/yyyy

        // --- Amount Formatting ---
        const amount = parseFloat(row.Amount);
        if (isNaN(amount)) {
          throw new Error(
            `Invalid 'Amount' in row ${rowIndex}: "${row.Amount}". Not a valid number.`
          );
        }
        // FreeAgent needs 2 decimal places. Revolut seems correct sign-wise.
        const formattedAmount = amount.toFixed(2);

        // --- Description Formatting ---
        // Clean description: remove commas, quotes, and newlines, then trim.
        let description = descriptionRaw.replace(/,/g, "").replace(/"/g, "");
        description = description.replace(/\r\n|\n|\r/gm, " ").trim();

        return {
          Date: formattedDate,
          Amount: formattedAmount,
          Description: description,
        };
      });
    } catch (e: any) {
      console.error("Revolut Conversion Error:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      // Prepend indication that it's a Revolut specific error
      return `Error during Revolut conversion: ${errorMessage}`;
    }
  };

  const handleDownload = () => {
    if (formattedTransactions.length === 0) {
      setError("No formatted data available to download.");
      return;
    }
    setError(null);

    const csv = Papa.unparse(formattedTransactions, {
      quotes: false,
      header: false,
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const baseName = originalFileName.replace(/\.[^/.]+$/, "");
    link.setAttribute("download", `${baseName || "download"}_freeagent.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTable = (
    data: Transaction[] | FreeAgentTransaction[],
    title: string
  ): JSX.Element | null => {
    if (!data) {
      return null; // No data provided at all
    }

    // Handle explicitly empty array (e.g., after failed processing)
    if (Array.isArray(data) && data.length === 0) {
      return <Typography sx={{ mt: 2 }}>No data to display.</Typography>;
    }

    // Ensure data[0] exists before trying to get keys from it
    if (!data[0]) {
      return (
        <Typography sx={{ mt: 2 }}>No data structure to display.</Typography>
      );
    }

    const headers = Object.keys(data[0]);

    return (
      <TableWrapper>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: "60vh" }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableCell key={header} sx={{ fontWeight: "bold" }}>
                    {header}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row, index) => (
                <TableRow key={index}>
                  {headers.map((header) => (
                    <TableCell key={header}>
                      {(row as Transaction)[header]}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </TableWrapper>
    );
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom align="center">
        Bank CSV to FreeAgent Converter
      </Typography>
      {error && !isModalOpen && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: 3,
          height: "calc(100vh - 150px)",
          width: "100%",
        }}
      >
        <Box
          sx={{
            width: { xs: "100%", md: "50%" },
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <StyledPaper elevation={3}>
            <Typography variant="h5" component="h2" gutterBottom>
              Source Bank Data Preview
            </Typography>
            <Button
              variant="contained"
              component="span"
              startIcon={<UploadFileIcon />}
              fullWidth
              onClick={handleOpenModal}
              sx={{ mb: 2 }}
            >
              Upload CSV File
            </Button>
            {originalTransactions.length > 0 ? (
              renderTable(
                originalTransactions,
                originalFileName || "Uploaded Transactions"
              )
            ) : (
              <Typography sx={{ mt: 2, textAlign: "center" }}>
                Upload a CSV file to see the preview.
              </Typography>
            )}
          </StyledPaper>
        </Box>

        <Box
          sx={{
            width: { xs: "100%", md: "50%" },
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          <StyledPaper elevation={3}>
            <Typography variant="h5" component="h2" gutterBottom>
              Formatted FreeAgent Data Preview
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={formattedTransactions.length === 0}
              fullWidth
              sx={{ mb: 2 }}
            >
              Download FreeAgent CSV
            </Button>
            {formattedTransactions.length > 0 ? (
              renderTable(formattedTransactions, "Preview for FreeAgent")
            ) : (
              <Typography sx={{ mt: 2, textAlign: "center" }}>
                Processed data will appear here.
              </Typography>
            )}
          </StyledPaper>
        </Box>
      </Box>

      <Dialog
        open={isModalOpen}
        onClose={handleCloseModal}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Upload Bank Statement CSV</DialogTitle>
        <DialogContent>
          {error && isModalOpen && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
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
            <Box
              sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 2 }}
            >
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
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button
            onClick={handleProcessUpload}
            variant="contained"
            disabled={!selectedFile || !selectedBank}
          >
            Process File
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default App;
