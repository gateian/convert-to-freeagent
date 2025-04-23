import React, { useState, useCallback } from "react";
import {
  Container,
  Grid,
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
} from "@mui/material";
import { styled } from "@mui/material/styles";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import Papa from "papaparse";

const Input = styled("input")({
  display: "none",
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: "100%",
  display: "flex",
  flexDirection: "column",
}));

const TableWrapper = styled(Box)({
  flexGrow: 1,
  overflow: "auto",
  marginTop: "16px", // Add some margin above the table
});

interface Transaction {
  [key: string]: string; // Allow any string keys
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

function App() {
  const [originalFileName, setOriginalFileName] = useState<string>("");
  const [originalTransactions, setOriginalTransactions] = useState<
    Transaction[]
  >([]);
  const [formattedTransactions, setFormattedTransactions] = useState<
    FreeAgentTransaction[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOriginalFileName(file.name);
      setError(null); // Clear previous errors
      setOriginalTransactions([]); // Clear previous data
      setFormattedTransactions([]); // Clear previous data

      Papa.parse<Transaction>(file, {
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
            return;
          }
          if (!results.data || results.data.length === 0) {
            setError("CSV file is empty or invalid.");
            return;
          }
          setOriginalTransactions(results.data);
          // --- Conversion logic will go here ---
          // For now, let's just set dummy formatted data
          const converted = convertToFreeAgentFormat(results.data);
          if (typeof converted === "string") {
            setError(converted);
          } else {
            setFormattedTransactions(converted);
          }
        },
        error: (err) => {
          console.error("PapaParse error:", err);
          setError(`Error reading file: ${err.message}`);
        },
      });
    }
    // Reset input value to allow uploading the same file again
    event.target.value = "";
  };

  // --- Updated Conversion Logic ---
  const convertToFreeAgentFormat = (
    data: Transaction[] // PapaParse gives Transaction[], we'll treat as StarlingTransaction inside
  ): FreeAgentTransaction[] | string => {
    try {
      const requiredColumns = ["Date", "Amount (GBP)", "Counter Party"];
      // Check if the first row has the required columns
      if (data.length > 0) {
        const firstRowKeys = Object.keys(data[0]);
        // Check for required columns specifically for Starling format
        if (!firstRowKeys.includes("Amount (GBP)")) {
          // Check specific Starling column name
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
        return []; // Return empty if no data
      }

      return data.map((rowUntyped, index) => {
        const row = rowUntyped as StarlingTransaction; // Treat row as StarlingTransaction
        const rowIndex = index + 2; // +1 for 0-based index, +1 for header row

        // --- Validation ---
        if (!row.Date) {
          throw new Error(`Missing 'Date' in row ${rowIndex}`);
        }
        if (row["Amount (GBP)"] === undefined || row["Amount (GBP)"] === null) {
          throw new Error(`Missing 'Amount (GBP)' in row ${rowIndex}`);
        }
        if (!row["Counter Party"]) {
          // Allow empty Counter Party, use empty string.
        }

        // --- Date Formatting ---
        const datePattern = /^\d{2}\/\d{2}\/\d{4}$/;
        if (!datePattern.test(row.Date)) {
          throw new Error(
            `Invalid date format in row ${rowIndex}: "${row.Date}". Expected dd/mm/yyyy.`
          );
        }
        const formattedDate = row.Date;

        // --- Amount Formatting ---
        const amount = parseFloat(row["Amount (GBP)"]);
        if (isNaN(amount)) {
          throw new Error(
            `Invalid 'Amount (GBP)' in row ${rowIndex}: "${row["Amount (GBP)"]}". Not a valid number.`
          );
        }
        const formattedAmount = amount.toFixed(2);

        // --- Description Formatting ---
        let description = row["Counter Party"] || "";
        if (row.Reference) {
          description += ` - ${row.Reference}`;
        }
        description = description.replace(/,/g, "").replace(/"/g, "");
        description = description.replace(/\r\n|\n|\r/gm, " ");

        return {
          Date: formattedDate,
          Amount: formattedAmount,
          Description: description,
        };
      });
    } catch (e: any) {
      console.error("Conversion Error:", e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      return `Error during conversion: ${errorMessage}`;
    }
  };

  const handleDownload = () => {
    if (formattedTransactions.length === 0) {
      setError("No formatted data available to download.");
      return;
    }
    setError(null); // Clear error

    const csv = Papa.unparse(formattedTransactions, {
      quotes: false, // Don't add quotes as per FreeAgent rules
      header: false, // No header row for FreeAgent
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    // Construct filename: originalName_freeagent.csv
    const baseName = originalFileName.replace(/\.[^/.]+$/, ""); // Remove original extension
    link.setAttribute("download", `${baseName}_freeagent.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderTable = (
    data: Transaction[] | FreeAgentTransaction[],
    title: string
  ) => {
    if (!data || data.length === 0) {
      return <Typography sx={{ mt: 2 }}>No data to display.</Typography>;
    }

    const headers = Object.keys(data[0]);

    return (
      <TableWrapper>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <TableContainer component={Paper} sx={{ maxHeight: "60vh" }}>
          {" "}
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
                    // Fix 2: Use more type-safe access
                    <TableCell key={header}>
                      {row[header as keyof typeof row]}
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
        Starling Bank CSV to FreeAgent Converter
      </Typography>
      {error && (
        <Typography color="error" align="center" sx={{ mb: 2 }}>
          Error: {error}
        </Typography>
      )}
      {/* Flexbox layout replacing Grid */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" }, // Stack vertically on small screens, row on medium+
          gap: 3, // Spacing between columns, replaces Grid spacing
          height: "calc(100vh - 150px)", // Maintain overall height
          width: "100%",
        }}
      >
        {/* Left Column Box */}
        <Box
          sx={{
            width: { xs: "100%", md: "50%" }, // Full width on small, half on medium+
            display: "flex", // Use flex for inner content alignment
            flexDirection: "column",
            height: "100%", // Ensure Box takes full height of flex container
          }}
        >
          <StyledPaper elevation={3}>
            <Typography variant="h5" component="h2" gutterBottom>
              Original Starling Data
            </Typography>
            <label htmlFor="upload-csv-button">
              <Input
                accept=".csv"
                id="upload-csv-button"
                type="file"
                onChange={handleFileUpload}
              />
              <Button
                variant="contained"
                component="span"
                startIcon={<UploadFileIcon />}
                fullWidth
              >
                Upload Starling CSV
              </Button>
            </label>
            {renderTable(
              originalTransactions,
              originalFileName || "Uploaded Transactions"
            )}
          </StyledPaper>
        </Box>

        {/* Right Column Box */}
        <Box
          sx={{
            width: { xs: "100%", md: "50%" }, // Full width on small, half on medium+
            display: "flex", // Use flex for inner content alignment
            flexDirection: "column",
            height: "100%", // Ensure Box takes full height of flex container
          }}
        >
          <StyledPaper elevation={3}>
            <Typography variant="h5" component="h2" gutterBottom>
              Formatted FreeAgent Data
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              disabled={formattedTransactions.length === 0}
              fullWidth
            >
              Download FreeAgent CSV
            </Button>
            {renderTable(formattedTransactions, "Preview for FreeAgent")}
          </StyledPaper>
        </Box>
      </Box>
    </Container>
  );
}

export default App;
