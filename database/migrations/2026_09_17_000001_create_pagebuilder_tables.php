<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('pagebuilder_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('context', 80)->index();
            $table->string('kind', 16);
            $table->json('document');
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
        });
        Schema::create('pagebuilder_contents', function (Blueprint $table) {
            $table->id();
            $table->string('mode', 16);
            $table->string('kind', 16);
            $table->json('document')->nullable();
            $table->foreignId('template_id')->nullable()->constrained('pagebuilder_templates')->restrictOnDelete();
            // An opaque exclusivity claim, NOT a polymorphic relation or owner lookup.
            $table->char('ownership_key', 64)->nullable()->unique();
            $table->unsignedInteger('revision')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pagebuilder_contents');
        Schema::dropIfExists('pagebuilder_templates');
    }
};
