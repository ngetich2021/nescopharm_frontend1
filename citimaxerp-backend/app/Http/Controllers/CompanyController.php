<?php

namespace App\Http\Controllers;

use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Http\Traits\HandlesDatabaseErrors;

class CompanyController extends Controller
{
    use HandlesDatabaseErrors;

    /**
     * Serve public branding assets (logo/letterhead) with explicit CORS headers.
     * These need to load cross-origin into <img crossorigin="anonymous"> so the
     * frontend can render them into a canvas for PDF export without tainting it.
     * Served through a real Laravel route (not a static public/ file) because
     * `php artisan serve` serves existing public/ files directly, bypassing all
     * middleware/headers entirely.
     */
    public function asset(string $filename)
    {
        if (!preg_match('/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/', $filename)) {
            abort(404);
        }

        $path = storage_path('app/company-assets/' . $filename);
        if (!is_file($path)) {
            abort(404);
        }

        $mime = match (strtolower(pathinfo($filename, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
        };

        // response()->file() sets Last-Modified/ETag from the file itself and
        // handles conditional GETs (If-Modified-Since/If-None-Match), so a
        // browser automatically picks up a replaced logo/letterhead instead
        // of blindly trusting a flat max-age the way the old plain
        // response(file_get_contents(...)) call did with no validator at all.
        // Cache lifetime is kept short since this is an admin-editable asset,
        // not a hashed/versioned build artifact.
        return response()->file($path, [
            'Content-Type' => $mime,
            'Cache-Control' => 'public, max-age=300, must-revalidate',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    public function __construct()
    {
        $this->middleware('auth:sanctum')->except('asset');
    }

    protected function hasPermission(Request $request, $permission, $resourceCompanyId = null)
    {
        $user = $request->user();
        $role = $user->role;
        if (!$role) {
            return false;
        }
        if ($role->hasPermission('can_manage_system')) {
            return true;
        }
        if ($role->hasPermission('can_manage_company')) {
            if ($resourceCompanyId !== null) {
                return $user->company_id === $resourceCompanyId;
            }
            return true;
        }
        return $role->hasPermission($permission);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_create_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to create companies.',
                'data' => null
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:companies,name',
            'description' => 'nullable|string',
            'email' => 'nullable|email|max:255|unique:companies,email',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'website' => 'nullable|string|max:255',
            'logo_url' => 'nullable|string',
            'letterhead_url' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        $company = Company::create([
            'id' => (string) Str::uuid(),
            'name' => $request->input('name'),
            'description' => $request->input('description'),
            'email' => $request->input('email'),
            'phone' => $request->input('phone'),
            'address' => $request->input('address'),
            'city' => $request->input('city'),
            'state' => $request->input('state'),
            'country' => $request->input('country'),
            'postal_code' => $request->input('postal_code'),
            'website' => $request->input('website'),
            'logo_url' => $request->input('logo_url'),
            'letterhead_url' => $request->input('letterhead_url'),
            'is_active' => true,
            'is_first_time' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Company created successfully',
            'company' => $company,
        ], 201);
    }

    public function update(Request $request, $id)
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_update_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to update companies.',
                'data' => null
            ], 403);
        }

        $company = Company::find($id);
        if (!$company) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Company not found'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255|unique:companies,name,' . $id,
            'description' => 'nullable|string',
            'email' => 'nullable|email|max:255|unique:companies,email,' . $id,
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'country' => 'nullable|string|max:100',
            'postal_code' => 'nullable|string|max:20',
            'website' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
            'is_first_time' => 'sometimes|boolean',
            'logo_url' => 'nullable|string',
            'letterhead_url' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'status' => 'failed',
                'message' => $validator->errors()
            ], 400);
        }

        $company->update($validator->validated());

        return response()->json([
            'status' => 'success',
            'message' => 'Company updated successfully',
            'company' => $company,
        ]);
    }

    public function show(Request $request, $id)
    {

        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_company', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view companies.',
                'data' => null
            ], 403);
        }

        $company = Company::find($id);
        if (!$company) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Company not found'
            ], 404);
        }
        return response()->json([
            'status' => 'success',
            'message' => 'Company retrieved successfully',
            'company' => $company,
        ], 200);
    }

    public function getCompanies(Request $request)
    {
        $user = $request->user();
        if (!$this->hasPermission($request, 'can_view_companies', $user->company_id)) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Unauthorized to view companies.',
                'data' => null
            ], 403);
        }

        try {
            $user = $request->user();
            $companies = Company::all();

            return response()->json([
                'status' => 'success',
                'message' => 'Companies retrieved successfully',
                'companies' => $companies,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Failed to retrieve companies: ' . $e->getMessage(),
            ], 500);
        }
    }
}
