const axios = require("axios");

/**
 * ID Verification Service
 * Uses Google Cloud Vision API to extract text from government IDs
 * and verify the name matches the applicant's entered name.
 */

// Common name variations and nicknames mapping
const NAME_VARIATIONS = {
  // Common nicknames
  william: ["will", "bill", "billy", "willy", "liam"],
  robert: ["rob", "bob", "bobby", "robbie"],
  richard: ["rick", "dick", "rich", "richie"],
  james: ["jim", "jimmy", "jamie"],
  michael: ["mike", "mikey", "mick"],
  joseph: ["joe", "joey"],
  thomas: ["tom", "tommy"],
  charles: ["charlie", "chuck", "chas"],
  christopher: ["chris", "topher", "kit"],
  daniel: ["dan", "danny"],
  matthew: ["matt", "matty"],
  anthony: ["tony", "ant"],
  david: ["dave", "davey"],
  edward: ["ed", "eddie", "ted", "teddy", "ned"],
  nicholas: ["nick", "nicky"],
  benjamin: ["ben", "benny", "benji"],
  alexander: ["alex", "xander", "sandy"],
  jonathan: ["jon", "jonny", "nathan"],
  timothy: ["tim", "timmy"],
  samuel: ["sam", "sammy"],
  stephen: ["steve", "stevie"],
  steven: ["steve", "stevie"],
  patrick: ["pat", "paddy"],
  andrew: ["andy", "drew"],
  joshua: ["josh"],
  kenneth: ["ken", "kenny"],
  gregory: ["greg", "gregg"],
  lawrence: ["larry", "laurie"],
  raymond: ["ray"],
  gerald: ["jerry", "gerry"],
  dennis: ["denny"],
  walter: ["walt", "wally"],
  // Female names
  elizabeth: ["liz", "lizzy", "beth", "betty", "eliza", "ellie"],
  jennifer: ["jen", "jenny", "jenn"],
  margaret: ["maggie", "meg", "peggy", "marge", "margie"],
  patricia: ["pat", "patty", "tricia", "trish"],
  katherine: ["kate", "kathy", "katie", "kay", "kit"],
  catherine: ["cathy", "kate", "katie", "kay"],
  christine: ["chris", "christy", "tina"],
  christina: ["chris", "christy", "tina"],
  stephanie: ["steph", "stephie"],
  melissa: ["mel", "missy", "lissa"],
  deborah: ["deb", "debbie", "debby"],
  jessica: ["jess", "jessie"],
  victoria: ["vicky", "vicki", "tori"],
  alexandra: ["alex", "alexa", "sandra", "sandy"],
  samantha: ["sam", "sammy"],
  rebecca: ["becca", "becky", "reba"],
  jacqueline: ["jackie", "jacqui"],
  amanda: ["mandy", "mandi"],
  susan: ["sue", "susie", "suzy"],
  dorothy: ["dot", "dottie", "dorrie"],
  theodore: ["ted", "teddy", "theo"],
  // Additional common variations
  abigail: ["abby", "gail"],
  madeline: ["maddie", "maddy"],
  natalie: ["nat", "nattie"],
  caroline: ["carol", "carrie"],
  gabrielle: ["gabby", "gabi"],
  isabella: ["bella", "izzy", "izzie"],
  olivia: ["liv", "livvy"],
  sophia: ["sophie", "soph"],
  angelina: ["angie", "angela"],
  maximilian: ["max"],
  sebastian: ["seb", "bastian"],
  nathaniel: ["nate", "nathan", "nat"],
  zachary: ["zach", "zack"],
  frederick: ["fred", "freddy", "rick"],
  phillip: ["phil"],
  philip: ["phil"],
  leonard: ["leo", "lenny"],
  ronald: ["ron", "ronnie"],
  donald: ["don", "donnie"],
  harold: ["harry", "hal"],
  henry: ["hank", "harry", "hal"],
  // Hispanic/Latino common names
  jose: ["joe", "pepe"],
  francisco: ["frank", "frankie", "paco", "pancho"],
  manuel: ["manny"],
  miguel: ["mike", "michael"],
  rafael: ["rafa", "ralph"],
  guillermo: ["will", "william", "memo"],
  roberto: ["rob", "robert", "bob"],
  carlos: ["carl", "charlie"],
  jorge: ["george"],
  juan: ["john", "johnny"],
  maria: ["mary"],
  guadalupe: ["lupe"],
  dolores: ["lola", "dolly"],
  concepcion: ["connie", "concha"],
};

/**
 * Normalize a name for comparison
 * - Lowercase
 * - Remove accents/diacritics
 * - Remove common suffixes (jr, sr, ii, iii, iv)
 * - Remove punctuation
 */
function normalizeName(name) {
  if (!name) return "";

  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[.,'-]/g, " ") // Replace punctuation with space
    .replace(/\b(jr|sr|ii|iii|iv|v|junior|senior)\b/gi, "") // Remove suffixes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Get all variations of a name (including nicknames)
 */
function getNameVariations(name) {
  const normalized = normalizeName(name);
  const variations = new Set([normalized]);

  // Check if this name has known variations
  if (NAME_VARIATIONS[normalized]) {
    NAME_VARIATIONS[normalized].forEach((v) => variations.add(v));
  }

  // Check if this name is a nickname of something else
  for (const [fullName, nicknames] of Object.entries(NAME_VARIATIONS)) {
    if (nicknames.includes(normalized)) {
      variations.add(fullName);
      nicknames.forEach((n) => variations.add(n));
    }
  }

  return variations;
}

/**
 * Check if two names match (considering variations and nicknames)
 */
function namesMatch(name1, name2) {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  // Exact match
  if (norm1 === norm2) return true;

  // Check if one is contained in the other (for middle names on IDs)
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Check variations
  const variations1 = getNameVariations(name1);
  const variations2 = getNameVariations(name2);

  for (const v1 of variations1) {
    if (variations2.has(v1)) return true;
  }

  return false;
}

/**
 * Calculate similarity score between two strings using Levenshtein distance
 */
function calculateSimilarity(str1, str2) {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  // Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= shorter.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= longer.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  const distance = matrix[shorter.length][longer.length];
  return (longerLength - distance) / longerLength;
}

/**
 * Extract text from image using Google Cloud Vision API
 */
async function extractTextFromImage(imageBase64) {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    console.warn("GOOGLE_CLOUD_VISION_API_KEY is not configured");
    return "";
  }

  // Validate input
  if (!imageBase64 || typeof imageBase64 !== "string") {
    console.warn("Invalid image data provided to extractTextFromImage");
    return "";
  }

  // Remove data URL prefix if present
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  // Validate base64 data isn't empty after stripping prefix
  if (!base64Data || base64Data.length < 100) {
    console.warn("Image data too small or empty");
    return "";
  }

  try {
    const response = await axios.post(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        requests: [
          {
            image: {
              content: base64Data,
            },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 1,
              },
              {
                type: "DOCUMENT_TEXT_DETECTION",
                maxResults: 1,
              },
            ],
          },
        ],
      },
      {
        timeout: 25000, // 25 second timeout
        maxContentLength: 15 * 1024 * 1024, // 15MB max
        maxBodyLength: 15 * 1024 * 1024,
      }
    );

    // Check for API errors in the response
    const apiError = response.data.responses?.[0]?.error;
    if (apiError) {
      console.error("Google Vision API error:", apiError);
      return "";
    }

    const textAnnotations = response.data.responses?.[0]?.textAnnotations;
    const fullTextAnnotation = response.data.responses?.[0]?.fullTextAnnotation;

    // Prefer full text annotation for better structure
    if (fullTextAnnotation?.text) {
      return fullTextAnnotation.text;
    }

    // Fall back to first text annotation (contains all text)
    if (textAnnotations && textAnnotations.length > 0) {
      return textAnnotations[0].description || "";
    }

    return "";
  } catch (error) {
    // Log detailed error for debugging but don't crash
    if (error.response) {
      console.error("Google Vision API HTTP error:", {
        status: error.response.status,
        data: error.response.data,
      });
    } else if (error.code === "ECONNABORTED") {
      console.error("Google Vision API timeout");
    } else {
      console.error("Google Vision API error:", error.message);
    }
    // Return empty string instead of throwing - let the caller handle gracefully
    return "";
  }
}

/**
 * Parse extracted text to find potential names
 * IDs typically have names in various formats:
 * - "LAST, FIRST MIDDLE"
 * - "FIRST MIDDLE LAST"
 * - Separate lines for first and last name
 */
function extractNamesFromText(text) {
  if (!text) return { potentialNames: [], fullText: "" };

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const potentialNames = [];

  // Common ID labels to skip
  const skipLabels = [
    "driver license", "driver's license", "drivers license",
    "identification card", "id card", "state of", "department of",
    "motor vehicles", "dmv", "date of birth", "dob", "exp", "expires",
    "expiration", "issued", "iss", "class", "sex", "hair", "eyes",
    "height", "weight", "address", "city", "state", "zip", "restrictions",
    "endorsements", "dd", "4d", "duplicate", "real id", "veteran",
    "passport", "united states", "nationality", "place of birth",
    "permanent resident", "uscis", "resident since", "category",
    "green card", "employment authorized", "valid for", "not valid for",
    "card expires", "i-551", "alien registration", "immigrant visa",
  ];

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    // Skip if line contains common labels
    if (skipLabels.some((label) => lowerLine.includes(label))) continue;

    // Skip if line is mostly numbers (dates, ID numbers, etc.)
    const digitRatio = (line.match(/\d/g) || []).length / line.length;
    if (digitRatio > 0.3) continue;

    // Skip very short or very long lines
    if (line.length < 2 || line.length > 50) continue;

    // Check if line looks like a name (contains mostly letters and spaces)
    const letterRatio = (line.match(/[a-zA-Z]/g) || []).length / line.length;
    if (letterRatio > 0.7) {
      // Check for "LAST, FIRST" format
      if (line.includes(",")) {
        const parts = line.split(",").map((p) => p.trim());
        if (parts.length >= 2) {
          potentialNames.push({
            lastName: parts[0],
            firstName: parts[1].split(" ")[0], // First word after comma
            middleName: parts[1].split(" ").slice(1).join(" ") || null,
            raw: line,
          });
        }
      } else {
        // Assume "FIRST MIDDLE LAST" or "FIRST LAST" format
        const words = line.split(/\s+/);
        if (words.length >= 2) {
          potentialNames.push({
            firstName: words[0],
            lastName: words[words.length - 1],
            middleName: words.length > 2 ? words.slice(1, -1).join(" ") : null,
            raw: line,
          });
        }
      }
    }
  }

  return {
    potentialNames,
    fullText: text,
  };
}

/**
 * Verify that the name on the ID matches the applicant's name
 */
async function verifyIdName(imageBase64, applicantFirstName, applicantLastName) {
  try {
    // Extract text from the ID image
    const extractedText = await extractTextFromImage(imageBase64);

    if (!extractedText) {
      return {
        verified: null,
        confidence: 0,
        message: "Could not read text from the ID photo. Please ensure the image is clear and well-lit. You may continue, but your application will be reviewed manually.",
        extractedText: "",
        suggestedNames: [],
        detectedName: null,
        skipped: true,
      };
    }

    // Parse the text to find potential names
    const { potentialNames, fullText } = extractNamesFromText(extractedText);

    if (potentialNames.length === 0) {
      return {
        verified: null,
        confidence: 0,
        message: "Could not identify a name on the ID. Please ensure you uploaded a valid government-issued ID with your name visible. You may continue, but your application will be reviewed manually.",
        extractedText: fullText,
        suggestedNames: [],
        detectedName: null,
        skipped: true,
      };
    }

    // Check each potential name for a match
    let bestMatch = null;
    let bestConfidence = 0;

    for (const name of potentialNames) {
      const firstNameMatch = namesMatch(name.firstName, applicantFirstName);
      const lastNameMatch = namesMatch(name.lastName, applicantLastName);

      // Calculate confidence based on matches
      let confidence = 0;
      if (firstNameMatch && lastNameMatch) {
        confidence = 1.0;
      } else if (lastNameMatch) {
        // Last name matches, check first name similarity
        const firstSimilarity = calculateSimilarity(name.firstName, applicantFirstName);
        confidence = 0.5 + firstSimilarity * 0.4; // 50-90%
      } else if (firstNameMatch) {
        // First name matches, check last name similarity
        const lastSimilarity = calculateSimilarity(name.lastName, applicantLastName);
        confidence = 0.3 + lastSimilarity * 0.4; // 30-70%
      } else {
        // Neither matches exactly, use similarity
        const firstSimilarity = calculateSimilarity(name.firstName, applicantFirstName);
        const lastSimilarity = calculateSimilarity(name.lastName, applicantLastName);
        confidence = (firstSimilarity + lastSimilarity) / 2;
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMatch = name;
      }
    }

    // Determine verification result
    const verified = bestConfidence >= 0.7; // 70% threshold
    let message;

    if (verified) {
      if (bestConfidence >= 0.95) {
        message = "Name on ID matches the entered name.";
      } else {
        message = "Name on ID appears to match the entered name.";
      }
    } else if (bestConfidence >= 0.4) {
      message = `The name on the ID (${bestMatch?.firstName} ${bestMatch?.lastName}) does not appear to match the entered name (${applicantFirstName} ${applicantLastName}). Please verify you entered your name exactly as it appears on your ID.`;
    } else {
      message = "Could not verify the name on the ID matches the entered name. Please ensure the ID photo is clear and shows your full legal name.";
    }

    return {
      verified,
      confidence: Math.round(bestConfidence * 100),
      message,
      extractedText: fullText,
      suggestedNames: potentialNames.slice(0, 3).map((n) => ({
        firstName: n.firstName,
        lastName: n.lastName,
      })),
      detectedName: bestMatch
        ? { firstName: bestMatch.firstName, lastName: bestMatch.lastName }
        : null,
    };
  } catch (error) {
    console.error("Error verifying ID:", error);
    // Return a graceful response that allows the application to continue
    return {
      verified: null,
      confidence: 0,
      message: "ID verification encountered an error. Your application will be reviewed manually.",
      extractedText: "",
      suggestedNames: [],
      detectedName: null,
      skipped: true,
    };
  }
}

module.exports = {
  verifyIdName,
  extractTextFromImage,
  extractNamesFromText,
  namesMatch,
  normalizeName,
  calculateSimilarity,
};
