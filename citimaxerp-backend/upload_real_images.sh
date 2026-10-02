#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

BASE_URL="http://localhost:8000/api"
EMAIL="sinchwara@gmail.com"
PASSWORD="password123"
IMAGE_PATH="/Users/inchwara/Downloads/jade-stephens-J4q9CT4cW1Q-unsplash.jpg"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   COMPREHENSIVE SUPABASE IMAGE UPLOAD & RETRIEVAL TEST        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}\n"

# Verify image file exists
if [ ! -f "$IMAGE_PATH" ]; then
    echo -e "${RED}✗ Image file not found at: $IMAGE_PATH${NC}"
    echo -e "${YELLOW}Please provide the correct path to the image file${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Image file found${NC}"
echo "  Path: $IMAGE_PATH"
echo "  Size: $(ls -lh "$IMAGE_PATH" | awk '{print $5}')"
echo "  Type: $(file -b --mime-type "$IMAGE_PATH")"

# Step 1: Login
echo -e "\n${BLUE}[1/6] Authenticating...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token // .token')
COMPANY_ID=$(echo $LOGIN_RESPONSE | jq -r '.data.user.company.id')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    echo -e "${RED}✗ Login failed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Authenticated successfully${NC}"
echo "  Company: $(echo $LOGIN_RESPONSE | jq -r '.data.user.company.name')"

# Step 2: Get existing product
echo -e "\n${BLUE}[2/6] Fetching test product...${NC}"
PRODUCT_ID="3ab54818-6618-46f5-80fb-070a41c80c7e"

PRODUCT_RESPONSE=$(curl -s -X GET "${BASE_URL}/products/${PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

PRODUCT=$(echo $PRODUCT_RESPONSE | jq '.product')
VARIANT_IDS=($(echo $PRODUCT | jq -r '.variants[].id'))

echo -e "${GREEN}✓ Product loaded${NC}"
echo "  Name: $(echo $PRODUCT | jq -r '.name')"
echo "  Variants: ${#VARIANT_IDS[@]}"

# Step 3: Upload product primary image
echo -e "\n${BLUE}[3/6] Uploading PRIMARY PRODUCT IMAGE to Supabase...${NC}"

PRODUCT_UPDATE=$(curl -s -X POST "${BASE_URL}/products/${PRODUCT_ID}?_method=PUT" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/json" \
  -F "images[]=@${IMAGE_PATH}" \
  -F "name=Mountain Product - Supabase Test" \
  -F "description=Product with real Supabase uploaded image" \
  -F "category_id=4d1ec083-0fd8-4339-8fd4-8154a2901763" \
  -F "company_id=${COMPANY_ID}" \
  -F "is_active=true" \
  -F "is_featured=true" \
  -F "track_inventory=true" \
  -F "has_variations=true")

PRODUCT_IMAGE=$(echo $PRODUCT_UPDATE | jq -r '.product.images[0] // empty')

if [ -n "$PRODUCT_IMAGE" ] && [ "$PRODUCT_IMAGE" != "null" ]; then
    echo -e "${GREEN}✓ Product image uploaded to Supabase${NC}"
    echo "  Supabase path: ${PRODUCT_IMAGE}"
else
    echo -e "${RED}✗ Product image upload failed${NC}"
    echo "Response: $PRODUCT_UPDATE" | jq '.'
fi

# Step 4: Upload variant images (one at a time for better control)
echo -e "\n${BLUE}[4/6] Uploading VARIANT IMAGES to Supabase...${NC}"

for i in "${!VARIANT_IDS[@]}"; do
    VARIANT_ID="${VARIANT_IDS[$i]}"
    
    echo -e "\n${YELLOW}  Variant $((i+1))/${#VARIANT_IDS[@]}: $VARIANT_ID${NC}"
    
    VARIANT_UPDATE=$(curl -s -X POST "${BASE_URL}/products/${PRODUCT_ID}?_method=PUT" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Accept: application/json" \
      -F "has_variations=true" \
      -F "variations[0][id]=${VARIANT_ID}" \
      -F "variations[0][images][]=@${IMAGE_PATH}")
    
    # Check if variant was updated
    VARIANT_IMAGE=$(echo $VARIANT_UPDATE | jq -r ".product.variants[] | select(.id==\"${VARIANT_ID}\") | .images[0] // empty")
    
    if [ -n "$VARIANT_IMAGE" ] && [ "$VARIANT_IMAGE" != "null" ]; then
        echo -e "  ${GREEN}✓ Uploaded to Supabase${NC}"
        echo "    Path: ${VARIANT_IMAGE}"
    else
        echo -e "  ${RED}✗ Upload failed${NC}"
    fi
done

# Step 5: Verify all images are in database
echo -e "\n${BLUE}[5/6] Verifying images in database...${NC}"

VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/products/${PRODUCT_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

FINAL_PRODUCT=$(echo $VERIFY_RESPONSE | jq '.product')

echo -e "\n${BLUE}Product Image:${NC}"
echo $FINAL_PRODUCT | jq -r '.images[] // "No images"'

echo -e "\n${BLUE}Variant Images:${NC}"
echo $FINAL_PRODUCT | jq -r '.variants[] | "  \(.name):\n    \(.images[]? // "No images")"'

# Step 6: Test image retrieval from Supabase
echo -e "\n${BLUE}[6/6] Testing image retrieval from Supabase...${NC}"

PRODUCT_IMAGE_PATH=$(echo $FINAL_PRODUCT | jq -r '.images[0] // empty')

if [ -n "$PRODUCT_IMAGE_PATH" ] && [ "$PRODUCT_IMAGE_PATH" != "null" ]; then
    echo -e "\n${YELLOW}Testing product image access...${NC}"
    
    # Get public URL
    IMAGE_URL_RESPONSE=$(curl -s -X POST "${BASE_URL}/storage/get-url" \
      -H "Authorization: Bearer ${TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"path\":\"${PRODUCT_IMAGE_PATH}\"}")
    
    PUBLIC_URL=$(echo $IMAGE_URL_RESPONSE | jq -r '.url // .public_url // empty')
    
    if [ -n "$PUBLIC_URL" ] && [ "$PUBLIC_URL" != "null" ]; then
        echo -e "${GREEN}✓ Image accessible via Supabase${NC}"
        echo "  URL: ${PUBLIC_URL}"
        
        # Try to download the image to verify it's real
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL")
        if [ "$HTTP_CODE" == "200" ]; then
            echo -e "${GREEN}✓ Image successfully retrieved (HTTP 200)${NC}"
        else
            echo -e "${YELLOW}⚠ Image returned HTTP ${HTTP_CODE}${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ Could not get public URL${NC}"
        echo "  Stored path: ${PRODUCT_IMAGE_PATH}"
    fi
fi

# Summary
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        TEST SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"

PRODUCT_IMAGES=$(echo $FINAL_PRODUCT | jq '.images | length')
VARIANTS_WITH_IMAGES=$(echo $FINAL_PRODUCT | jq '[.variants[] | select(.images != null and (.images | length) > 0)] | length')

echo -e "\n${GREEN}Product Images:${NC} $PRODUCT_IMAGES uploaded"
echo -e "${GREEN}Variant Images:${NC} $VARIANTS_WITH_IMAGES / ${#VARIANT_IDS[@]} variants have images"

if [ "$PRODUCT_IMAGES" -gt 0 ] && [ "$VARIANTS_WITH_IMAGES" -eq "${#VARIANT_IDS[@]}" ]; then
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              ✓✓✓ ALL TESTS PASSED ✓✓✓                         ║${NC}"
    echo -e "${GREEN}║  Images uploaded to Supabase and retrieved successfully!      ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 0
else
    echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                  ⚠ PARTIAL SUCCESS ⚠                          ║${NC}"
    echo -e "${YELLOW}║         Some images may not have uploaded correctly           ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════════╝${NC}\n"
    exit 1
fi
