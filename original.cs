using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;


    /// <summary>
    /// A class for generating Uniform Structure (BKM) Files as defined by the tax dept.
    /// </summary>
class BKMFileCreator
{
    static string dest = "C:\\Users\\User3\\Desktop\\Israel";
    static string programID = ""; // <============== Missing Program Info
    static string programName = "חשבונית בענן";
    static string programVersion = "1.0";
    static string programCompanyID = "";
    static string programCompanyName = "וירטק סופטוור בע\"מ";
    static char alphaNumPadding = ' ';
    static char numericPadding = '0';
    static string debugFieldSep = "\0"; // put '\0' to see the fields more clearly
    static bool countRegistriesFrom0 = true;
    static int debugCompanyID;

    /// <summary>
    /// Allows the user to set a new path in which the file will be made
    /// </summary>
    public static void SetPath(string path)
    {
        dest = path;
    }

    /// <summary>
    /// Switches debug mode on and off.
    /// </summary>
    /// <param name="isDebug">Whether debug mode should be on (true) or off (false).</param>
    public static void setDebugMode (bool isDebug)
    {
        debugFieldSep = isDebug ? "\0" : "";
    }

    /// <summary>
    ///  Generates a new BKMFile for the given company and time period
    /// </summary>
    public static string GenFile(int companyID, DateTime from, DateTime to)
    {
        int lineNo;
        int mainFID = 1;
        int headerID = 1;
        int itemNo = 0;

        int C100Cnt = 0;
        int D110Cnt = 0;
        int D120Cnt = 0;

        StreamWriter bkmfile;
        StreamWriter inifile;
        List<string> files = new List<string>();
        DBInvoiceEntities DBC = new DBInvoiceEntities();
        tbCompany company = DBC.tbCompanies.Find(companyID);

        if (company == null)
            return null;
        debugCompanyID = companyID;
        mainFID = DBC.tbCommons.First().LastBKMId.Value + 1; // set new doc ID

        if (countRegistriesFrom0)
            lineNo = 0;
        else
            lineNo = 1;

        var query = from docs in DBC.tbUserDocuments // load docs which are to be exported
                    select docs;
        query = query.Where(x => x.CompanyID == companyID && x.Date >= from && x.Date <= to);
        query = query.Where(x => x.DocumentType >= 1 && x.DocumentType <= 4);

        string fileIdentifier;
        fileIdentifier = companyID + "_" + from.ToString("yyyy-MM-dd") + "_" + to.ToString("yyyy-MM-dd");
        Directory.CreateDirectory(dest + "\\" + fileIdentifier); // creates a temp directory for file creation

        // =========================== BKMDATA.txt ==========================

        string path = dest + "\\" + fileIdentifier + "\\BKMVDATA.txt";
        bkmfile = File.CreateText(path);

        lineNo = addA100(bkmfile, lineNo, mainFID, company); // create file header
        //tbUserDocument doc = query.First();
        foreach (tbUserDocument doc in query) // iterate through all relevant documents
        {
            lineNo = addC100(bkmfile, lineNo, doc, DBC, headerID); // create document header
            C100Cnt++;
            itemNo = 1;

            var itemQuery = from items in DBC.tbDocumentProducts // iterate through all relevant item lines in document
                            select items;
            itemQuery = itemQuery.Where(x => x.DocumentID == doc.Id);
            foreach (tbDocumentProduct item in itemQuery)
            {
                lineNo = addD110(bkmfile, lineNo, item, DBC, headerID, itemNo);
                D110Cnt++;
                itemNo++;
            }

            var paymentQuery = from payments in DBC.tbDocumentPayments // iterate through all relevant payment lines in document
                               select payments;
            paymentQuery = paymentQuery.Where(x => x.DocID == doc.Id);
            foreach (tbDocumentPayment payment in paymentQuery)
            {
                lineNo = addD120(bkmfile, lineNo, payment, DBC, headerID, itemNo);
                D120Cnt++;
                itemNo++;
            }

            headerID++;
        }

        lineNo = addZ900(bkmfile, lineNo, mainFID, company);
        bkmfile.Close();
        files.Add(path);

        // =========================== INI.txt ===========================

        path = dest + "\\" + fileIdentifier + "\\INI.txt";
        inifile = File.CreateText(path);

        addA000(inifile, mainFID, company, lineNo, from, to);
        addRowCountByType(inifile, "C100", C100Cnt);
        addRowCountByType(inifile, "D110", D110Cnt);
        addRowCountByType(inifile, "D120", D120Cnt);
        inifile.Close();
        files.Add(path);

        // ========================== zip file ===========================

        path = dest + "\\BKM_" + fileIdentifier + ".zip";
        if (File.Exists(path)) // make sure the file does not exist as to prevent crashes
            File.Delete(path);
        ZipFileCreator.CreateZipFile(path, files);

        // ========================== DB update ==========================

        DBC.tbCommons.First().LastBKMId = mainFID;
        DBC.SaveChanges();
        DBC.Dispose();

        // ====================== Temp Dir Cleanup =======================

        foreach (string filepath in Directory.GetFiles(dest + "\\" + fileIdentifier)) // remove all temp files
            File.Delete(filepath);
        Directory.Delete(dest + "\\" + fileIdentifier); // remove temp directory when done

        return "BKM_" + fileIdentifier + ".zip";

    }
    /// <summary>
    /// adds a file header A100
    /// </summary>
    /// <param name="bkmfile">destination .txt file</param>
    /// <param name="lineNo">current line number</param>
    /// <param name="mainFID">current file identifier ID</param>
    /// <param name="infoSrc">the company for which the file is made</param>
    /// <returns>next line number</returns>
    private static int addA100(StreamWriter bkmfile, int lineNo, int mainFID, tbCompany infoSrc)
    {
        writeToFileFormatted(bkmfile, "A100", 4, true);
        writeToFileFormatted(bkmfile, lineNo.ToString(), 9, false);
        writeToFileFormatted(bkmfile, infoSrc.Identificator, 9, false);
        writeToFileFormatted(bkmfile, mainFID.ToString(), 15, false);
        writeToFileFormatted(bkmfile, "&OF1.31&", 8, true);
        writeToFileFormatted(bkmfile, "", 50, true);
        bkmfile.WriteLine(); // End of Line
        bkmfile.Flush();
        return lineNo + 1;
    }

    /// <summary>
    /// adds a file closer Z900
    /// </summary>
    /// <param name="bkmfile">destination .txt file</param>
    /// <param name="lineNo">current line number</param>
    /// <param name="mainFID">current file identifier ID</param>
    /// <param name="infoSrc">the company for which the file is made</param>
    /// <returns>next line number</returns>
    private static int addZ900(StreamWriter bkmfile, int lineNo, int mainFID, tbCompany infoSrc)
    {
        writeToFileFormatted(bkmfile, "Z900");
        writeToFileFormatted(bkmfile, lineNo.ToString(), 9, false);
        writeToFileFormatted(bkmfile, infoSrc.Identificator, 9, false);
        writeToFileFormatted(bkmfile, mainFID.ToString(), 15, false);
        writeToFileFormatted(bkmfile, "&OF1.31&");

        if (countRegistriesFrom0)
            writeToFileFormatted(bkmfile, (lineNo + 1).ToString(), 15, false);
        else
            writeToFileFormatted(bkmfile, (lineNo).ToString(), 15, false);

        writeToFileFormatted(bkmfile, "", 50, true);
        bkmfile.WriteLine(); // End of Line
        return lineNo + 1;
    }

    /// <summary>
    /// adds a document header C100
    /// </summary>
    /// <param name="bkmfile">destination .txt file</param>
    /// <param name="lineNo">current line number</param>
    /// <param name="infoSrc">the document of which the header is generated</param>
    /// <param name="DBC">a connection to the SQL DB</param>
    /// <param name="headerID">the ID number of the currently created header, unique for each header in a file</param>
    /// <returns>next line number</returns>
    private static int addC100(StreamWriter bkmfile, int lineNo, tbUserDocument infoSrc, DBInvoiceEntities DBC, int headerID)
    {
        writeToFileFormatted(bkmfile, "C100");
        writeToFileFormatted(bkmfile, lineNo.ToString(), 9, false);
        writeToFileFormatted(bkmfile, infoSrc.CompanyIdentificator, 9, false);
        switch (infoSrc.DocumentType)
        {
            case 1: writeToFileFormatted(bkmfile, "305");
                break;
            case 2: writeToFileFormatted(bkmfile, "320");
                break;
            case 3: writeToFileFormatted(bkmfile, "400");
                break;
            case 4: writeToFileFormatted(bkmfile, "330");
                break;
            default:
                throw new ArgumentException("The given document is not one of the 4 types supported by the bkmfile format.", "infoSrc");
        }
        writeToFileFormatted(bkmfile, infoSrc.DocumentNumber.ToString(), 20, false);
        writeToFileFormatted(bkmfile, infoSrc.CreationDate.HasValue ? infoSrc.CreationDate.Value.ToString("yyyyMMdd") : "", 8, true);
        writeToFileFormatted(bkmfile, infoSrc.CreationDate.HasValue ? infoSrc.CreationDate.Value.ToString("HHmm") : "", 4, true);
        writeToFileFormatted(bkmfile, infoSrc.CustomerName, 50, true);

        //string[] addr = breakAddress(infoSrc.CustomerAddress);  // obsolete
        writeToFileFormatted(bkmfile, "", 50, true);
        writeToFileFormatted(bkmfile, "", 10, true);
        writeToFileFormatted(bkmfile, infoSrc.CustomerACity, 30, true);
        writeToFileFormatted(bkmfile, infoSrc.CustomerAIndex, 8, true);
        writeToFileFormatted(bkmfile, infoSrc.CustomerACountry, 30, true);
        writeToFileFormatted(bkmfile, "", 2, true);                             // <==================== Missing country code !      
        writeToFileFormatted(bkmfile, infoSrc.CustomerPhone, 15, true);
        writeToFileFormatted(bkmfile, infoSrc.CustomerIdentificator, 9, false);

        writeToFileFormatted(bkmfile, infoSrc.CreationDate.HasValue ? infoSrc.DueDate.Value.ToString("yyyyMMdd") : "", 8, true);
        writeToFileFormatted(bkmfile, "", 15, true);    // these fields are always empty in our case
        writeToFileFormatted(bkmfile, "", 3, true);

        writeToFileFormatted(bkmfile, (double)(infoSrc.Total - infoSrc.NdsV + infoSrc.DiscV), 15, false);
        writeToFileFormatted(bkmfile, (double)(infoSrc.DiscV), 15, false);
        writeToFileFormatted(bkmfile, (double)(infoSrc.Total - infoSrc.NdsV), 15, false);
        writeToFileFormatted(bkmfile, (double)(infoSrc.NdsV), 15, false);
        writeToFileFormatted(bkmfile, (double)(infoSrc.Total), 15, false);
        writeToFileFormatted(bkmfile, "", 12, true);    // this field is always empty 

        writeToFileFormatted(bkmfile, (infoSrc.CustomerID).ToString(), 15, true);
        writeToFileFormatted(bkmfile, "", 1, true);    // this field is always empty 
        writeToFileFormatted(bkmfile, infoSrc.Date.ToString("yyyyMMdd"));
        writeToFileFormatted(bkmfile, "", 7, true);    // this field is always empty 

        var query = from users in DBC.tbUsers
                    select users;
        tbUser actuatorUser = query.First(x => x.Id == infoSrc.UserID);
        writeToFileFormatted(bkmfile, (actuatorUser.LName).ToString(), 9, true);
        writeToFileFormatted(bkmfile, headerID.ToString(), 7, false);
        writeToFileFormatted(bkmfile, "", 13, true);
        bkmfile.WriteLine(); // End of Line
        bkmfile.Flush();
        return lineNo + 1;
    }

    /// <summary>
    /// adds an item in a document D110
    /// </summary>
    /// <param name="bkmfile">destination .txt file</param>
    /// <param name="lineno">current line number</param>
    /// <param name="infoSrc">the item inside the document</param>
    /// <param name="DBC">a connection to the SQL DB</param>
    /// <param name="headerID">The headerID number of the related header </param>
    /// <param name="lineInFile">the item number in the document</param>
    /// <returns>next line number</returns>
    private static int addD110(StreamWriter bkmfile, int lineno, tbDocumentProduct infoSrc, DBInvoiceEntities DBC, int headerID, int lineInFile)
    {
        tbUserDocument generalDocInfo;
        tbProduct productInfo;

        generalDocInfo = DBC.tbUserDocuments.Find(infoSrc.DocumentID);
        productInfo = DBC.tbProducts.Find(infoSrc.ProductID);

        writeToFileFormatted(bkmfile, "D110");
        writeToFileFormatted(bkmfile, lineno.ToString(), 9, false);
        writeToFileFormatted(bkmfile, generalDocInfo.CompanyIdentificator, 9, false);
        switch (generalDocInfo.DocumentType)
        {
            case 1: writeToFileFormatted(bkmfile, "305");
                break;
            case 2: writeToFileFormatted(bkmfile, "320");
                break;
            case 3: writeToFileFormatted(bkmfile, "400");
                break;
            case 4: writeToFileFormatted(bkmfile, "330");
                break;
            default:
                throw new ArgumentException("The given document is not one of the 4 types supported by the bkmfile format.", "infoSrc");
        }
        writeToFileFormatted(bkmfile, generalDocInfo.DocumentNumber.ToString(), 20, false);
        writeToFileFormatted(bkmfile, lineInFile.ToString(), 4, false);
        writeToFileFormatted(bkmfile, "", 3, true);    // these fields are always empty
        writeToFileFormatted(bkmfile, "", 20, true);
        writeToFileFormatted(bkmfile, "", 1, true);

        writeToFileFormatted(bkmfile, infoSrc.ProductID.ToString(), 20, true);
        writeToFileFormatted(bkmfile, infoSrc.Name, 30, true);
        writeToFileFormatted(bkmfile, "", 50, true);
        writeToFileFormatted(bkmfile, (productInfo != null) ? productInfo.Makat : "", 30, true);
        writeToFileFormatted(bkmfile, "", 20, true);

        writeToFileFormatted(bkmfile, infoSrc.Amount, 17, true);
        writeToFileFormatted(bkmfile, infoSrc.Price, 15, false);
        writeToFileFormatted(bkmfile, "", 15, true);
        writeToFileFormatted(bkmfile, (double)(infoSrc.Price * infoSrc.Amount), 15, false);
        writeToFileFormatted(bkmfile, generalDocInfo.NdsInc.Value ? (generalDocInfo.Nds * 100).ToString() : "00.0", 4, false);
        writeToFileFormatted(bkmfile, "", 7, true);

        writeToFileFormatted(bkmfile, generalDocInfo.Date.ToString("yyyyMMdd"));
        writeToFileFormatted(bkmfile, headerID.ToString(), 7, false);
        writeToFileFormatted(bkmfile, "", 7, true);
        writeToFileFormatted(bkmfile, "", 21, true);
        bkmfile.WriteLine(); // End of Line
        bkmfile.Flush();
        return lineno + 1;
    }
    /// <summary>
    /// adds a payment in a document D120
    /// </summary>
    /// <param name="bkmfile">destination .txt file</param>
    /// <param name="lineno">current line number</param>
    /// <param name="infoSrc">the payment inside the document</param>
    /// <param name="DBC">a connection to the SQL DB</param>
    /// <param name="headerID">The headerID number of the related header </param>
    /// <param name="lineInFile">the item number in the document</param>
    /// <returns>next line number</returns>
    /// 
    private static int addD120(StreamWriter bkmfile, int lineno, tbDocumentPayment infoSrc, DBInvoiceEntities DBC, int headerID, int lineInFile)
    {
        tbUserDocument generalDocInfo;
        bool isCheck = false;
        generalDocInfo = DBC.tbUserDocuments.Find(infoSrc.DocID);

        writeToFileFormatted(bkmfile, "D120");
        writeToFileFormatted(bkmfile, lineno.ToString(), 9, false);
        writeToFileFormatted(bkmfile, generalDocInfo.CompanyIdentificator, 9, false);
        switch (generalDocInfo.DocumentType)
        {
            case 1: writeToFileFormatted(bkmfile, "305");
                break;
            case 2: writeToFileFormatted(bkmfile, "320");
                break;
            case 3: writeToFileFormatted(bkmfile, "400");
                break;
            case 4: writeToFileFormatted(bkmfile, "330");
                break;
            default:
                throw new ArgumentException("The given document is not one of the 4 types supported by the bkmfile format.", "infoSrc");
        }
        writeToFileFormatted(bkmfile, generalDocInfo.DocumentNumber.ToString(), 20, false);
        writeToFileFormatted(bkmfile, lineInFile.ToString(), 4, false);
        switch (infoSrc.TypeID)
        {
            case 1: writeToFileFormatted(bkmfile, "2");
                isCheck = true;
                break;
            case 2: writeToFileFormatted(bkmfile, "1");
                break;
            case 3: writeToFileFormatted(bkmfile, "4");
                break;
            default: writeToFileFormatted(bkmfile, "9");
                break;
        }
        writeToFileFormatted(bkmfile, (isCheck ? infoSrc.BankCode.ToString() : ""), 10, false);
        writeToFileFormatted(bkmfile, (isCheck ? infoSrc.BranchCode.ToString() : ""), 10, false);
        writeToFileFormatted(bkmfile, (isCheck ? infoSrc.Account.ToString() : ""), 15, false);
        writeToFileFormatted(bkmfile, (isCheck ? infoSrc.Check.ToString() : ""), 10, false);

        writeToFileFormatted(bkmfile, infoSrc.Date.HasValue ? infoSrc.Date.Value.ToString("yyyyMMdd") : "", 8, true);
        writeToFileFormatted(bkmfile, infoSrc.Total.HasValue ? infoSrc.Total.Value : 0, 15, false);
        writeToFileFormatted(bkmfile, "", 1, true); // we do not handle crdit card transactions
        writeToFileFormatted(bkmfile, "", 20, true);
        writeToFileFormatted(bkmfile, "", 1, true);
        writeToFileFormatted(bkmfile, generalDocInfo.Date.ToString("yyyyMMdd"));
        writeToFileFormatted(bkmfile, headerID.ToString(), 7, false);
        writeToFileFormatted(bkmfile, "", 60, true);

        bkmfile.WriteLine(); // End of Line
        bkmfile.Flush();
        return lineno + 1;
    }

    /// <summary>
    /// adds a file header A000
    /// </summary>
    /// <param name="inifile">destination .txt file</param>
    /// <param name="mainFID">current file Identifier ID</param>
    /// <param name="infoSrc">the company for which the file is made</param>
    /// <param name="lineCnt">the overall number of lines in the BKMfile</param>
    /// <param name="from">the beginning of the time range for which the file is generated</param>
    /// <param name="to">the end of the time range for which the file is generated</param>
    private static void addA000(StreamWriter inifile, int mainFID, tbCompany infoSrc, int lineCnt, DateTime from, DateTime to)
    {
        writeToFileFormatted(inifile, "A000");
        writeToFileFormatted(inifile, "", 5, true);
        writeToFileFormatted(inifile, lineCnt.ToString(), 15, false);
        writeToFileFormatted(inifile, infoSrc.Identificator, 9, false);
        writeToFileFormatted(inifile, mainFID, 15, false);
        writeToFileFormatted(inifile, "&OF1.31&");

        writeToFileFormatted(inifile, programID, 8, false);
        writeToFileFormatted(inifile, programName, 20, true);
        writeToFileFormatted(inifile, programVersion, 20, true);
        writeToFileFormatted(inifile, programCompanyID, 9, true);
        writeToFileFormatted(inifile, programCompanyName, 20, true);
        writeToFileFormatted(inifile, "2");
        writeToFileFormatted(inifile, "", 50, true);
        writeToFileFormatted(inifile, "0");
        writeToFileFormatted(inifile, "", 1, false);

        writeToFileFormatted(inifile, infoSrc.Identificator, 9, false);
        writeToFileFormatted(inifile, "", 9, false);
        writeToFileFormatted(inifile, "", 10, true);
        writeToFileFormatted(inifile, infoSrc.Name, 50, true);

        writeToFileFormatted(inifile, "", 50, true);
        writeToFileFormatted(inifile, "", 10, true);
        writeToFileFormatted(inifile, infoSrc.City, 30, true);
        writeToFileFormatted(inifile, infoSrc.Index, 8, true);

        writeToFileFormatted(inifile, "", 4, true);
        writeToFileFormatted(inifile, from.ToString("yyyyMMdd"), 8, true);
        writeToFileFormatted(inifile, to.ToString("yyyyMMdd"), 8, true);
        writeToFileFormatted(inifile, DateTime.Now.ToString("yyyyMMdd"), 8, true);
        writeToFileFormatted(inifile, DateTime.Now.ToString("HHmm"), 4, true);
        writeToFileFormatted(inifile, "0");
        writeToFileFormatted(inifile, "1",1,true); // <================= unsure about used charset (for Hebrew), tax dept. handbook says 1 for windows
        writeToFileFormatted(inifile, "WinZip",20,true);
        writeToFileFormatted(inifile, "ILS");
        writeToFileFormatted(inifile, "0");
        writeToFileFormatted(inifile, "",46,true);

        inifile.WriteLine(); // End of Line
        inifile.Flush();
    }

    /// <summary>
    /// Adds a row that stores how many rows of the given type exist in the BKM file.
    /// </summary>
    /// <param name="inifile">destination .txt file</param>
    /// <param name="countedRowType">The name of the row type as given by the tax dept. (for example C100)</param>
    /// <param name="cnt">The number of rows of this type</param>
    private static void addRowCountByType(StreamWriter inifile, string countedRowType, int cnt)
    {
        writeToFileFormatted(inifile, countedRowType, 4, true);
        writeToFileFormatted(inifile, cnt, 15, false);
        inifile.WriteLine(); // End of Line
        inifile.Flush();
    }

    /// <summary>
    /// Breaks the given address string into its components (House No, Street, City)
    /// </summary>
    /// <param name="address">address in the following format: "[Country],[City],[HouseNo] [Street]"</param>
    /// <returns>array of strings where: [0]-Country, [1]-City, [2]-Street, [3]-HouseNo</returns>
    private static string[] breakAddress(string address)
    {
        string[] res = new string[4];
        if (address == null)
            return res;

        string[] tempBreak = address.Split(',');
        try
        {
            res[0] = tempBreak[2].Trim();
            res[1] = tempBreak[1].Trim();
            tempBreak = tempBreak[0].Split(' ');
            res[2] = tempBreak[0].Trim();
            res[3] = "";
            foreach (string streetNamePart in tempBreak.Skip(1))
            {
                res[3] += streetNamePart + " ";
            }
            res[3].Trim();
        }
        catch (IndexOutOfRangeException)
        {
            return res;
        }
        return res;
    }

    /// <summary>
    ///  prints out a given field to the given file with a field seperator character at the end of the field.
    /// </summary>
    /// <param name="file">destination .txt file</param>
    /// <param name="text">the field value to be written</param>
    private static void writeToFileFormatted(StreamWriter file, string text)
    {
        writeToFileFormatted(file, text, text.Length, true);
    }

    /// <summary>
    /// prints out a given field to the given file with a field seperator character at the end of the field. 
    /// The field's length is checked and truncated / padded if needed to meet the given length requirements.
    /// </summary>
    /// <param name="file">destination .txt file</param>
    /// <param name="text">the field value to be written</param>
    /// <param name="length">the exact length of the field that needs to be written</param>
    /// <param name="isAlphaNumeric">use numeric or alphaNumeric padding ?</param>
    private static void writeToFileFormatted(StreamWriter file, string text, int length, bool isAlphaNumeric)
    {
        if (text == null)
            text = "";

        if (text.Length > length)
            text = text.Substring(0, length);
        file.Write(text.PadLeft(length, isAlphaNumeric ? alphaNumPadding : numericPadding) + debugFieldSep);
    }

    private static void writeToFileFormatted(StreamWriter file, double num, int length, bool isAlphaNumeric)
    {
        num = Math.Round(num, 2);
        writeToFileFormatted(file, num.ToString(), length, isAlphaNumeric);
    }

    /*
    private static void breakAddressFields (InvoiceModel DBC)
    {
        var query = from docs in DBC.tbUserDocuments
                    select docs;
        string[] addrBreak;
        tbUserDocument dbDoc;
        foreach (tbUserDocument doc in query)
        {
            addrBreak = breakAddress(doc.CustomerAddress);
            dbDoc = DBC.tbUserDocuments.Find(doc.Id);
            dbDoc.CustomerACountry = addrBreak[0];
            dbDoc.CustomerACity = addrBreak[1];
            dbDoc.CustomerAStreet = addrBreak[2] + " " + addrBreak[3];
            DBC.SaveChanges();
        }      
    }*/
}
